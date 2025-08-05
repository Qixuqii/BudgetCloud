import express from "express"
import cors from "cors"
import transactionRouters from "./routes/transactions.js"
import ledgerMembers from "./routes/ledgerMembers.js"
import authRouters from "./routes/auth.js"
import userRouters from "./routes/users.js"
import cookieParser from "cookie-parser";

const app = express();

app.use(cors()) // Enable CORS
app.use(express.json())
app.use(cookieParser())
app.use("/api/transactions", transactionRouters)
app.use("/api/ledgers", ledgerMembers)
app.use("/api/auth", authRouters)
app.use("/api/users", userRouters)

app.listen(8800, () => {
    console.log("Connected!")
})
