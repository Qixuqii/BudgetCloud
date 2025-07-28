import React from 'react'
import  {useState} from 'react'
import { Link, useNavigate } from "react-router-dom"
import axios from 'axios'

const Register = () => {
  const navigate = useNavigate();

  const [err, setErr] = useState(null)

  const [inputs, setInputs] = useState({
    username:"",
    email:"",
    password:"",
  })

  const handleChange = (e) =>{
    setInputs(prev=>({...prev, [e.target.name]: e.target.value}))
  }

  const handleSubmit = async e =>{
    e.preventDefault()
    // 阻止表单默认刷新页面（非常重要）
    try{
      
      const rst = await axios.post("/api/auth/register", inputs)
      console.log("###",rst)
      navigate("/login")
    }catch(err){
      setErr(err.response.data)
    }
  }

  return (
    <div className='auth'>
      <h1>Register</h1>
      <form>
        <input required type="text" placeholder='username' name='username' onChange={handleChange}/>
        <input required type="email" placeholder='email' name='email' onChange={handleChange}/>
        <input required type="password" placeholder='password' name='password' onChange={handleChange}/>
        {/* 这些 <input> 加上了 required，
        所以当你提交 <form> 表单时，如果用户 没有填写这些输入框的内容，浏览器会自动阻止提交，并提示用户补全 */}
        <button onClick={handleSubmit}>Register</button>
        {err && <p>{err}</p>}
        <span>Do you have an account? <Link to="/login">Login</Link>
        </span>
      </form>
    </div>
  )
}

export default Register
