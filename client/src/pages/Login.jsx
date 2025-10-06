import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/authContext.jsx';
import { GoogleLogin } from '@react-oauth/google';

const Login = () => {
  const navigate = useNavigate();

  const [inputs, setInputs] = useState({
    username: '',
    password: '',
  });

  const [err, setErr] = useState(null);

  const { login, googleLogin } = useContext(AuthContext);

  const toErrMsg = (e, fallback = 'Login failed') => {
    const data = e?.response?.data;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      return data.message || data.error || fallback;
    }
    return e?.message || fallback;
  };

  const handleChange = (e) => {
    setInputs((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(inputs);
      navigate('/');
    } catch (error) {
      setErr(toErrMsg(error));
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      if (!credentialResponse || !credentialResponse.credential) {
        setErr('Google sign-in failed: no credential');
        return;
      }
      await googleLogin(credentialResponse.credential);
      navigate('/');
    } catch (e) {
      setErr(toErrMsg(e, 'Google sign-in failed'));
    }
  };

  return (
    <div className='auth'>
      <div className='auth-card'>
        <h1>Login</h1>
        <form>
          <input required type='text' placeholder='Username' name='username' onChange={handleChange} />
          <input required type='password' placeholder='Password' name='password' onChange={handleChange} />
          <button onClick={handleSubmit}>Login</button>
          {err && <p className='error-text'>{String(err)}</p>}
        </form>

        <div className='oauth-divider'><span>or</span></div>

        <div className='google-login'>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setErr('Google sign-in failed, please try again')}
          />
        </div>

        <div className='switch-text'>
          Don’t have an account? <Link to='/register'>Register</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;

