import { db } from "../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID || undefined);

export const register = async (req, res) => {
    try{
        //查询是否已存在用户
        //CHECK EXSISTING USER
        const regcheckq = "SELECT * FROM users WHERE email = ? OR username = ?";
        const [userCheck] = await db.query(regcheckq, [req.body.email, req.body.username]);
        //const result = await db.query(...)中results是一个数组=[rows, fileds]，fields:列信息目前用不上
        // 这里加上[],所以userCheck=rows等价于以前的data
        if (userCheck.length) {
            return res.status(409).json("User already exists!");
        }

        //密码加密
        //Hash password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(req.body.password, salt);

        const reginsertq = "INSERT INTO users(`username`, `email`, `password_hash`) VALUES (?)";
        const values = [req.body.username, req.body.email, hash];
        await db.query(reginsertq, [values]);
        return res.status(200).json("User has been created.")

    }catch(err){
        console.log("Register error:", err);
        return res.status(500).json(err);
    }
};


export const login = async (req, res) => {
    try{
        //CHECK USER
        const logincheckq = "SELECT * FROM users WHERE username = ?";
        const [users] = await db.query(logincheckq, [req.body.username]);

        if (users.length === 0) return res.status(404).json("User not found!");

        //Check password
        const user = users[0];
        const isPasswordCorrect = bcrypt.compareSync(req.body.password, user.password_hash);
        if (!isPasswordCorrect) return res.status(400).json("Wrong password or username!");
        
        const token = jwt.sign({ id: user.id }, "jwtkey");
        const { password_hash, ...other } = user;

        res
            .cookie("access_token", token, {
                httpOnly: true,// 表示这个 cookie 不能被前端 JavaScript 访问，只在 HTTP 请求中携带（更安全）
            })
            .status(200)
            .json(other);

    }catch (err){
        console.log("Login error:", err);
        return res.status(500).json(err);
    }

};

export const logout = (req, res) => {

    res.clearCookie("access_token",{
        sameSite:"none",
        secure:true
    }).status(200).json("User has been logged out.");

};

// Google OAuth login using ID token from @react-oauth/google
export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json("Missing Google credential");

    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID || undefined });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json("Invalid Google token");

    const email = payload.email;
    const username = payload.name || email.split("@")[0];

    // Find existing user by email
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    let user = users && users[0];
    if (!user) {
      // Insert new user with a placeholder password hash (not used for OAuth login)
      const placeholder = await bcrypt.hash("google-oauth-login", 10);
      const insertValues = [username, email, placeholder];
      const insertQ = "INSERT INTO users(`username`, `email`, `password_hash`) VALUES (?)";
      const result = await db.query(insertQ, [insertValues]);
      const insertedId = result && result[0] && result[0].insertId;
      // Fetch the inserted user row
      const [createdRows] = await db.query("SELECT * FROM users WHERE id = ?", [insertedId]);
      user = createdRows[0];
    }

    // Issue our own JWT and httpOnly cookie
    const token = jwt.sign({ id: user.id }, "jwtkey");
    const { password_hash, ...other } = user;

    res
      .cookie("access_token", token, { httpOnly: true })
      .status(200)
      .json(other);
  } catch (err) {
    console.log("Google login error:", err);
    return res.status(500).json("Google login failed");
  }
};
