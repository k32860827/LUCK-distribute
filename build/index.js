"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const ethers_1 = require("ethers");
const abi_1 = require("./abi");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
const provider = new ethers_1.ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, provider);
const token = new ethers_1.ethers.Contract(process.env.TOKEN_CONTRACT_ADDRESS, abi_1.ERC20_ABI, wallet);
app.get("/status", (req, res) => {
    res.status(200).json({ status: "OK", message: "Server is live" });
});
app.post("/distribute", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { recipient, value } = req.body;
    if (!recipient || !value) {
        res.status(400).json({
            error: "Missing required fields",
            requiredFields: ["recipient", "value"],
        });
        return;
    }
    if (!ethers_1.ethers.isAddress(recipient) || typeof value !== "number") {
        res.status(400).json({ error: "Invalid recipient or value" });
        return;
    }
    try {
        const decimals = yield token.decimals();
        const tokenUnit = value / 100;
        const amountToDistribute = tokenUnit * 0.97;
        const parsedAmount = ethers_1.ethers.parseUnits(amountToDistribute.toFixed(Number(decimals)), decimals);
        const adminAddress = yield wallet.getAddress();
        const balance = yield token.balanceOf(adminAddress);
        if (balance < parsedAmount) {
            res.status(403).json({
                error: "Insufficient token balance",
                adminBalance: ethers_1.ethers.formatUnits(balance, decimals),
                required: amountToDistribute,
            });
            return;
        }
        const tx = yield token.transfer(recipient, parsedAmount);
        yield tx.wait();
        res.json({
            message: "Tokens distributed",
            txHash: tx.hash,
            distributedAmount: amountToDistribute,
        });
        return;
    }
    catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Token transfer failed", details: err.message });
        return;
    }
}));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Distributor API running on port ${PORT}`);
});
