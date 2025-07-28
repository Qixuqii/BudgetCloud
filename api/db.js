import mysql from "mysql2";

export const db = mysql.createConnection({
    host:"localhost",
    user:"root",
    password:"Shimysql110!",
    database:"budget_tracker"
})