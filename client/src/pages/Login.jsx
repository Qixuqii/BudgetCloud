import React from 'react'
import  {useState, useContext} from 'react'
import { Link, useNavigate } from "react-router-dom";
import axios  from "axios";
import { AuthContext } from '../context/authContext.jsx';



const Login = () => {
  const navigate = useNavigate();

  const [inputs, setInputs] = useState({
    username:"",
    password:"",
  })

  const [err, setErr] = useState(null);

  const { login } = useContext(AuthContext);
  console.log(login);

  const handleChange = (e) =>{
    setInputs(prev=>({...prev, [e.target.name]: e.target.value}))
  }

  const handleSubmit = async e =>{
    e.preventDefault()
    // 阻止表单默认刷新页面（非常重要）
    try{
      await login(inputs);
      // await axios.post("/api/auth/login", inputs)
      navigate("/")
    }catch(err){
      setErr(err.response.data)
    }
  }
  
  return (
    <div className='auth'>
      <h1>Login</h1>
      <form>
        <input required type="text" placeholder='username' name='username' onChange={handleChange}/>
        <input required type="password" placeholder='password' name='password' onChange={handleChange}/>
        <button onClick={handleSubmit}>Login</button>
        {err && <p>{err}</p>}
        <span>Don't you have an account? <Link to="/register">Register</Link>
        </span>
      </form>
    </div>
  )
}

export default Login
