import React from "react";
import { Link } from "react-router-dom";
import logo from "../images/cash.png";
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
          <span className="brand">Budget Tracker</span>
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
          <Link className="link" to="/category">
            <h6>Category</h6>
          </Link>
          <Link className="link" to="/calendar">
            <h6>Calendar</h6>
          </Link>
          <Link className="link" to="/ledgers">
            <h6>Budget</h6>
          </Link>
          {currentUser ? (
            <div className="user" title={currentUser?.username}>
              <span className="initial">{String(currentUser?.username || 'G').slice(0,1).toUpperCase()}</span>
              <button className="logout" onClick={logout}>Logout</button>
            </div>
          ) : (
            <Link className="link" to="/login">
              Login
            </Link>
          )}
          {/* <span className="write">
            <Link className="link" to="/write">
              Write
            </Link>
          </span> */}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
