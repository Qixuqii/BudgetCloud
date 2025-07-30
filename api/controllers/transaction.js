import { db } from "../db.js";

export const getTransactions = (req, res) => {
    const userId = req.user.id;//从 JWT token 中提取当前登录用户 ID
    const categoryId = req.query.category_id;// 从请求 URL 里提取参数，是查询参数前面要加？
    const { ledger_id, min_amount, max_amount, type, start_date, end_date } = req.query;
    // ? "SELECT * FROM transactions WHERE category_id = ?"
    // : "SELECT * FROM transactions";

    let userId_q = "SELECT * FROM transactions WHERE user_id = ?";
    let userId_params = [userId];// 参数数组，表示 SQL 中的 ? 要被什么替代。这里是把第一个 ? 替换为用户 ID
    //用let是因为后面修改这个变量了，let用来声明一个可变变量，const是声明一个不可变变量

    if (categoryId) {
        userId_q += " AND category_id = ?";
        userId_params.push(categoryId);
    }
    if (ledger_id) {
        userId_q += " AND ledger_id = ?";
        userId_params.push(ledger_id);
    }
    if (min_amount) {
        userId_q += " AND amount >= ?";
        userId_params.push(min_amount);
    }
    if (max_amount) {
        userId_q += " AND amount <= ?";
        userId_params.push(max_amount);
    }
    if (type) {
        userId_q += " AND type = ?";
        userId_params.push(type);
    }
    if (start_date) {
        userId_q += " AND date >= ?";
        userId_params.push(start_date);
    }
    if (end_date) {
        userId_q += " AND date <= ?";
        userId_params.push(end_date);
    }

    db.query(userId_q, userId_params, (err, data) => {
        if (err) return res.status(500).send(err);
        if (data.length === 0){
            return res.status(404).json({ message: "No transactions found" });
        }
        return res.status(200).json(data);
    })
    //db.query(SQL字符串里面有?占位,参数数组里有值用来依次替换SQL中的占位符?,callback回调函数)
}

export const getTransaction = (req, res) => {
    const userId = req.user.id;
    const transactionsId = req.params.id;//路径参数，前面要加:

    const q = "SELECT * FROM transactions WHERE id = ? AND user_id = ?";
    db.query(q, [transactionsId, userId], (err, data) => {
        if (err) return res.status(500).send(err);
        if (data.length === 0) return res.status(404).json({ message: "Transaction not found" });

        return res.status(200).json(data[0]);
    });

}

export const addTransaction = (req, res) => {
    const userId = req.user.id;
    const { ledger_id, category_id, amount, type,
        note = "",//默认空字符串
        date = new Date().toISOString().slice(0, 10)
    } = req.body;

    if (!ledger_id || !category_id || !amount || !type) {
        return res.status(400).json({
            message: "Must provide ledger_id, category_id, amount, and type"
        });
    }
    if (type !== "income" && type !== "expense") {
        return res.status(400).json({
            message: " type must be either 'income' or 'expense'"
        });
    }

    const q = `INSERT INTO transactions
    (user_id, ledger_id, category_id, amount, type, note, date)
    VALUES(?, ?, ?, ?, ?, ?, ?)`;//`是多行字符串的开始和结束符号

    const values = [userId, ledger_id, category_id, amount, type, note, date];
    db.query(q, values, (err, data) => {
        if (err) {
            console.error("新增交易出错:", err); // 打印错误日志，方便你调试！
            return res.status(500).json({ error: "Database insert fail" });
        }

        return res.status(201).json({
            message: "Transaction added successfully",
            transaction_id: data.insertId
        });
    });
}

export const deleteTransaction = (req, res) => {
    const userId = req.user.id;
    const transactionId = req.params.id;

    const check_q = "SELECT * FROM transactions WHERE user_id = ? AND id = ?";
    db.query(check_q, [userId, transactionId], (err, data) => {
        if (err) {
            console.error("查询交易出错:", err);
            return res.status(500).json({ message: "Databse query fail" });
        }
        if (data.length === 0) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        const delete_q = "DELETE FROM transactions WHERE user_id = ? AND id = ?";
        db.query(delete_q, [userId, transactionId], (err, data) => {
            if (err) {
                console.error("删除交易失败:", err);
                return res.status(500).json({ message: "Delete failed" });
            }
            return res.status(200).json({ message: "Transaction deleted successfully" });
        });
    });
}

export const updateTransaction = (req, res) => {
    const userId = req.user.id;
    const transactionId = req.params.id;

    const { ledger_id, category_id, amount, type,
        note,
        date
    } = req.body;



    const fields = [];
    const values = [];

    if (ledger_id !== undefined) {
        fields.push("ledger_id = ?");
        values.push(ledger_id);
    }
    if (category_id !== undefined) {
        fields.push("category_id = ?");
        values.push(category_id);
    }
    if (amount !== undefined) {
        fields.push("amount = ?");
        values.push(amount);
    }
    if (type !== undefined) {
        if (type !== "income" && type !== "expense") {
            return res.status(400).json({ message: "type must be 'income' or 'expense'" });
        }
        fields.push("type = ?");
        values.push(type);
    }
    if (note !== undefined) {
        fields.push("note = ?");
        values.push(note);
    }

    if (date !== undefined) {
        fields.push("date = ?");
        values.push(date);
    }
    if (fields.length === 0) {
        return res.status(400).json({ message: "No fields to update." });
    }

    const check_q = "SELECT * FROM transactions WHERE user_id = ? AND id = ?";
    db.query(check_q, [userId, transactionId], (err, data) => {
        if (err) {
            console.error("查询交易出错:", err);
            return res.status(500).json({ message: "Databse query fail" });
        }
        if (data.length === 0) {
            return res.status(404).json({ message: "Transaction not found or unauthorized" });
        }


        
        const update_q = `UPDATE transactions SET ${fields.join(", ")} WHERE user_id = ? AND id = ?`;
        values.push(userId, transactionId);
        //fields.join(", ") 把数组转换成字符串，逗号分隔
        db.query(update_q, values, (err, data) => {
            if (err) {
                console.error("更新交易失败:", err);
                return res.status(500).json({ message: "Upadate failed" });
            }
            return res.status(200).json({ message: "Transaction updated successfully" })
        });
    });
}