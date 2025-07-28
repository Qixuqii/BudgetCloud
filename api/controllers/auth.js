import { db } from "../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {
    //CHECK EXSISTING USER
    const regcheckq = "SELECT * FROM users WHERE email = ? OR username = ?";

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(req.body.password, salt);

    db.query(regcheckq, [req.body.email, req.body.username], (err, data) => {
        console.log("###", err, data);
        if (err) return res.json(err);
        if (data.length) {
            return res.status(409).json("User already exists!");
        }

        const reginsertq = "INSERT INTO users(`username`, `email`, `password_hash`) VALUES (?)";
        const values = [req.body.username, req.body.email, hash];

        db.query(reginsertq, [values], (err, data) => {
            if (err) return res.json(err);
            return res.status(200).json("User has been created.");
        })

    });


};


export const login = (req, res) => {
    //CHECK USER
    const logincheckq = "SELECT * FROM users WHERE username = ?";

    db.query(logincheckq, [req.body.username], (err, data) => {
        if (err) return res.json(err);
        if (data.length === 0) return res.status(404).json("User not found!");

        //Check password
        const isPasswordCorrect = bcrypt.compareSync(req.body.password, data[0].password_hash);
        if (!isPasswordCorrect) return res.status(400).json("Wrong password or username!");
        
        const token = jwt.sign({ id: data[0].id }, "jwtkey");
        const { password_hash, ...other } = data[0];

        res
            .cookie("access_token", token, {
                httpOnly: true,// 表示这个 cookie 不能被前端 JavaScript 访问，只在 HTTP 请求中携带（更安全）
            })
            .status(200)
            .json(other);
    });

};
export const logout = (req, res) => {

    res.clearCookie("access_token",{
        sameSite:"none",
        secure:true
    }).status(200).json("User has been logged out.");

};