import express, { Application, Request, Response } from "express";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { ERC20_ABI } from "./abi";

dotenv.config();

const app: Application = express();
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const token = new ethers.Contract(process.env.TOKEN_CONTRACT_ADDRESS!, ERC20_ABI, wallet);

app.post("/distribute", async (req: Request, res: Response): Promise<void> => {
    const { recipient, value } = req.body;

    if (!recipient || !value) {
         res.status(400).json({
            error: "Missing required fields",
            requiredFields: ["recipient", "value"],
        });
        return;
    }

    if (!ethers.isAddress(recipient) || typeof value !== "number") {
        res.status(400).json({ error: "Invalid recipient or value" });
        return;
    }

    try {
        const decimals = await token.decimals();
        
        const tokenUnit = value / 100;
        const amountToDistribute = tokenUnit * 0.97;

        const parsedAmount = ethers.parseUnits(
            amountToDistribute.toFixed(Number(decimals)),
            decimals
        );        
        const tx = await token.transfer(recipient, parsedAmount);
        await tx.wait();

        res.json({
            message: "Tokens distributed",
            txHash: tx.hash,
            distributedAmount: amountToDistribute,
        });
        return

    } catch (err: any) {
        console.error("Error:", err);
        res.status(500).json({ error: "Token transfer failed", details: err.message });
        return;

    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Distributor API running on port ${PORT}`);
});