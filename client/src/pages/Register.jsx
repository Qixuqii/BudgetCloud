import React from 'react'
import  {useState} from 'react'
import { Link, useNavigate } from "react-router-dom"
import axios from 'axios'

const Register = () => {
  const navigate = useNavigate();

  const [err, setErr] = useState(null)

  const toErrMsg = (e, fallback = 'Register failed') => {
    const data = e?.response?.data;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      return data.message || data.error || fallback;
    }
    return e?.message || fallback;
  };

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
      setErr(toErrMsg(err))
    }
  }

  return (
    <div className='auth'>
      <div className='auth-card'>
      <h1>Register</h1>
      <form>
        <input required type="text" placeholder='Username' name='username' onChange={handleChange}/>
        <input required type="email" placeholder='Email' name='email' onChange={handleChange}/>
        <input required type="password" placeholder='Password' name='password' onChange={handleChange}/>
        {/* 这些 <input> 加上了 required，
        所以当你提交 <form> 表单时，如果用户 没有填写这些输入框的内容，浏览器会自动阻止提交，并提示用户补全 */}
        <button onClick={handleSubmit}>Register</button>
        {err && <p className='error-text'>{String(err)}</p>}
      </form>
      <div className='switch-text'>Already have an account? <Link to="/login">Login</Link></div>
      </div>
    </div>
  )
}

export default Register
