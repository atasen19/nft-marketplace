const { expect } = require("chai");
const { ethers } = require("hardhat");
const toWei = (num) => ethers.utils.parseEther(num.toString())
const fromWei = (num) => ethers.utils.formatEther(num)

describe("NFTMarketplace", function () {
    
    let deployer, addr1, addr2, addrs, nft, NFT, marketplace, Marketplace; 
    let feePercent = 1
    let URI = "Sample URI";

    beforeEach(async function () {
        NFT = await ethers.getContractFactory("NFT");
        Marketplace = await ethers.getContractFactory("Marketplace");
        [deployer, addr1, addr2, ...addrs] = await ethers.getSigners()
        nft = await NFT.deploy();
        marketplace = await Marketplace.deploy(feePercent);
    });

    describe("Deployment", function(){
        it("should track name and symbol of the nft collection", async function(){
            expect(await nft.name()).to.equal("DApp NFT")
            expect(await nft.symbol()).to.equal("DAPP")
        });

        it("should track feeAccount and feePercent of the marketplace", async function(){
            expect(await marketplace.feeAccount()).to.equal(deployer.address);
            expect(await marketplace.feePercent()).to.equal(feePercent)
        });
    })

    describe("Minting NFTs", function(){
        it("should track each minted NFT", async function(){
            await nft.connect(addr1).mint(URI);
            expect(await nft.tokenCount()).to.equal(1);
            expect(await nft.balanceOf(addr1.address)).to.equal(1);
            expect(await nft.tokenURI(1)).to.equal(URI);

            await nft.connect(addr2).mint(URI);
            expect(await nft.tokenCount()).to.equal(2);
            expect(await nft.balanceOf(addr2.address)).to.equal(1);
            expect(await nft.tokenURI(2)).to.equal(URI);
        })
        
    })

    describe("Makin marketplace items", function(){
        let price = 1;
        beforeEach(async function() {
            await nft.connect(addr1).mint(URI);
            await nft.connect(addr1).setApprovalForAll(marketplace.address, true);
        })
        it("should track newly created item, transfer NFT from seller to marketplace and emit Offered event", async function(){
            await expect(marketplace.connect(addr1).makeItem(nft.address, 1, toWei(1)))
                .to.emit(marketplace, "Offered")
                .withArgs(
                    1,
                    nft.address,
                    1,
                    toWei(1),
                    addr1.address
                );

            expect(await nft.ownerOf(1)).to.equal(marketplace.address);
            expect(await marketplace.itemCount()).to.equal(1);
            const item = await marketplace.items(1)
            expect(item.itemId).to.equal(1)
            expect(item.nft).to.equal(nft.address)
            expect(item.tokenId).to.equal(1)
            expect(item.price).to.equal(toWei(price))
            expect(item.sold).to.equal(false)
        })

        it("Should fail if price is set to zero", async function () {
            await expect(
              marketplace.connect(addr1).makeItem(nft.address, 1, 0)
            ).to.be.revertedWith("Price must be greater than zero");
          });
    })

    describe("Purchasing marketplace items", function () {
        let price = 2
        let fee = (feePercent/100)*price
        beforeEach(async function() {
            // addr1 mints an nft
            await nft.connect(addr1).mint(URI);
            // marketplace is allowed by addr1 to spend the nft
            await nft.connect(addr1).setApprovalForAll(marketplace.address, true);
            // addr1 makes its nft a marketplace item
            await marketplace.connect(addr1).makeItem(nft.address, 1, toWei(2));
        })

        it.only("should update items as sold, should pay seller, transfer nft to buyer, charge fees and emit a Bought event", async function() {
            const sellerInitBal = await addr1.getBalance();
            const feeAccountInitBal = await deployer.getBalance();
            console.warn('sellerInitBal', sellerInitBal);
            console.warn('feeAccountInitBal', feeAccountInitBal);
            let totalPriceInWei = await marketplace.getTotalPrice(1);
            console.warn('totalPriceInWei', totalPriceInWei);
            // let addr2 purchase an item
            await expect(marketplace.connect(addr2).purchaseItem(1, { value: totalPriceInWei }))
                .to.emit(marketplace, "Bought")
                .withArgs(
                    1,
                    nft.address,
                    1,
                    toWei(price),
                    addr1.address,
                    addr2.address
                )
            
                const sellerFinalBalance = await addr1.getBalance();
                const feeAccountFinalBalance = await deployer.getBalance();

                expect((await marketplace.items(1)).sold).to.equal(true);

                // Seller should receive payment for the nft she sold
                expect(+fromWei(sellerFinalBalance)).to.equal(+price + +fromWei(sellerInitBal))
                // feeAccount should receive fee
                expect(+fromWei(feeAccountFinalBalance)).to.equal(+price + +fromWei(feeAccountInitBal))
                // // the buyer should now own the nft
                // expect(await nft.ownerOf(1)).to.equal(addr2.address)
            })

        it("should fail for invalid item ids, sold items and when not enough eth is paid", async function() {
            let totalPriceInWei = await marketplace.getTotalPrice(1);
            // fail for invalid item ids
            // await expect(marketplace.connect(addr2).purchaseItem(2, { value: totalPriceInWei})).to.be.revertedWith("item does not exist");
            // await expect(marketplace.connect(addr2).purchaseItem(0, { value: totalPriceInWei})).to.be.revertedWith("item does not exist");

            // await expect(marketplace.connect(addr2).purchaseItem(1, { value: totalPriceInWei})).to.be.revertedWith("not enough eth to pay item price and market fee together");
            await marketplace.connect(addr2).purchaseItem(1, {value: totalPriceInWei})
            const addr3 = addrs[0]
            await expect(marketplace.connect(addr3).purchaseItem(1, {value: totalPriceInWei})).to.be.revertedWith("this item already sold!");
        })
    })
})