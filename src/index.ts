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

app.get("/status", (req: Request, res: Response) => {
    res.status(200).json({ status: "OK", message: "Server is live" });
});

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


        const adminAddress = await wallet.getAddress();
        const balance = await token.balanceOf(adminAddress);

        if (balance < parsedAmount) {
            res.status(403).json({
                error: "Insufficient token balance",
                adminBalance: ethers.formatUnits(balance, decimals),
                required: amountToDistribute,
            });
            return;
        }

        // ✅ Estimate gas
        const estimatedGas = await token["transfer"].estimateGas(recipient, parsedAmount);
        
        // Optionally check if admin has enough ETH to cover gas fees
        const feeData = await provider.getFeeData();
        
        const gasPrice = feeData.gasPrice;
       
        if (!gasPrice) {
            throw new Error("Unable to fetch gas price from provider.");
        }

        const estimatedFee = estimatedGas * gasPrice;
        
        const ethBalance = await provider.getBalance(adminAddress);
        if (ethBalance < estimatedFee) {
            res.status(403).json({
                error: "Insufficient balance for gas",
                estimatedGas: estimatedGas.toString(),
                gasPrice: ethers.formatUnits(gasPrice, "gwei") + " Gwei",
                requiredEth: ethers.formatEther(estimatedFee),
            });
            return;
        }
        console.log("transfer");
        const tx = await token.transfer(recipient, parsedAmount);
        await tx.wait();
        console.log("transfer after");
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