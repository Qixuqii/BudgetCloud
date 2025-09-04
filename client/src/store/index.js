import { configureStore } from '@reduxjs/toolkit';
import ledgerReducer from '../features/ledger/ledgerSlice';

// 将各个 slice reducer 注册到这里，例如：
// import userReducer from '../features/user/userSlice';
// reducer: { user: userReducer }

export const store = configureStore({
  reducer: {ledger: ledgerReducer,},
  devTools: import.meta.env.MODE !== 'production',
});

export default store;

