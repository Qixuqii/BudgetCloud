import { db } from "../db.js";

export const getTransactions = (req, res) =>{
    const userId = req.user.id;//从 JWT token 中提取当前登录用户 ID
    const categoryId = req.query.category_id;// 从请求 URL 里提取参数
    // ? "SELECT * FROM transactions WHERE category_id = ?"
    // : "SELECT * FROM transactions";

    let userId_q= "SELECT * FROM transactions WHERE user_id = ?";
    let userId_params = [userId];// 参数数组，表示 SQL 中的 ? 要被什么替代。这里是把第一个 ? 替换为用户 ID

    if(categoryId) {
        userId_q += " AND category_id = ?";
        userId_params.push(categoryId);
    }
    
    db.query(userId_q, userId_params, (err, data) => {
        if (err) return res.status(500).send(err);

        return res.status(200).json(data);
    })
    //db.query(SQL字符串里面有?占位,参数数组里有值用来依次替换SQL中的占位符?,callback回调函数)
}
export const getTransaction = (req, res) =>{
    res.json("from controller")
}
export const addTransaction = (req, res) =>{
    res.json("from controller")
}
export const deleteTransaction = (req, res) =>{
    res.json("from controller")
}
export const updateTransaction = (req, res) =>{
    res.json("from controller")
}