import React from "react";
import { Link } from "react-router-dom";
import logo from "../images/logo.svg";
import "../style.scss";
import { useContext } from "react";
import { AuthContext } from "../context/authContext";

const Navbar = () => {
  const { currentUser, logout } = useContext(AuthContext);

  return (
    <div className="navbar">
      <div className="container">
        <div className="logo">
          <img src={logo} alt="" />
        </div>
        <div className="links">
          <Link className="link" to="/?cat=art">
            {/* 查询参数 cat=art */}
            <h6>Dashboard</h6>
            {/* ART */}
          </Link>
          <Link className="link" to="/expenses">
            <h6>Expense</h6>
          </Link>
          <Link className="link" to="/incomes">
            <h6>Income</h6>
          </Link>
          <Link className="link" to="/?cat=Category">
            <h6>Category</h6>
          </Link>
          <Link className="link" to="/?cat=Calender">
            <h6>Calender</h6>
          </Link>
          <Link className="link" to="/ledgers">
            <h6>Budget</h6>
          </Link>
          <span>{currentUser?.username}</span>
          {currentUser ? (
            <span onClick={logout}>Logout</span>
          ) : (
            <Link className="link" to="/login">
              Login
            </Link>
          )}
          <span className="write">
            <Link className="link" to="/write">
              Write
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
