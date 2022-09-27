import { useState } from "react"

const Home = ({marketplace, nft}) => {
    const [items, setItems] = useState([])
    const loadMarketplaceItems = async () => {
        // get the number of items
        const itemCount = await marketplace.itemCount();
        let items = []
        for (let i = 1; i<= itemCount; i++){
            const item = await marketplace.items[i];
            if(!item.sold){
                const uri = await nft.tokenURI(item.tokenId);
            }
        }
    }
    return (
        <div className="flex justify-center">

        </div>
    )
}

export default Home