import { useEffect, createContext, useState } from "react";
import axios from "axios";
// import { Children } from "react";

export const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(
    JSON.parse(localStorage.getItem("user")) || null
  );

  const login = async (inputs) => {
    const res = await axios.post("/api/auth/login", inputs);
    //await 是等待浏览器向后端发送请求并等待服务器处理并回应相应例如{“id”：1}然后把这个变成res
    // 不然后面的res.data就会undefined
    setCurrentUser(res.data);
  };

  const logout = async (inputs) => {
    await axios.post("/api/auth/logout");
    setCurrentUser(null);
  };

  useEffect(() => {
    localStorage.setItem("user", JSON.stringify(currentUser));
  }, [currentUser]);
  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
