// src/features/ledger/ledgerSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import storage from '../../utils/storage';
import * as api from '../../services/ledgers';

/* ---------- 异步 Action ---------- */

// 获取所有账本
export const loadLedgers = createAsyncThunk('ledger/loadLedgers', async () => {
  const data = await api.fetchLedgers();
  return data;                // [{id,name, ...}, ...]
});

// 获取指定账本的详情（交易汇总、预算进度、AI 总结等）
export const loadLedgerDetail = createAsyncThunk(
  'ledger/loadLedgerDetail',
  async (arg) => {
    const id = (arg && typeof arg === 'object') ? arg.id : arg;
    const period = (arg && typeof arg === 'object') ? arg.period : undefined;
    const data = await api.fetchLedgerDetail(id, period);
    return data;              // {id, name, summary, budgetLimits, aiSummary, members...}
  }
);

// 创建账本
export const createNewLedger = createAsyncThunk(
  'ledger/createNewLedger',
  async (payload) => {
    const data = await api.createLedger(payload);
    return data;
  }
);

// 更新账本（名称等）
export const saveLedger = createAsyncThunk(
  'ledger/saveLedger',
  async ({ id, changes }) => {
    const data = await api.updateLedger(id, changes);
    return data;
  }
);

// 删除/退出账本
export const removeLedger = createAsyncThunk(
  'ledger/removeLedger',
  async (id) => {
    await api.deleteLedger(id);
    return id;
  }
);

// 退出账本（非所有者）
export const leaveLedgerAction = createAsyncThunk(
  'ledger/leaveLedger',
  async (id) => {
    await api.leaveLedger(id);
    return id;
  }
);

// 成员管理
export const loadMembers = createAsyncThunk('ledger/loadMembers', api.fetchMembers);
export const inviteLedgerMember = createAsyncThunk(
  'ledger/inviteMember',
  async ({ id, payload }) => api.inviteMember(id, payload)
);
export const changeMemberRole = createAsyncThunk(
  'ledger/changeMemberRole',
  async ({ id, memberId, role }) => api.updateMemberRole(id, memberId, role)
);
export const deleteMember = createAsyncThunk(
  'ledger/deleteMember',
  async ({ id, memberId }) => {
    await api.removeMember(id, memberId);
    return memberId;
  }
);

/* ---------- 初始状态 ---------- */
const initialState = {
  items: [],                 // 所有账本
  currentId: storage.get('currentLedgerId'), // 当前选择的账本 ID（持久化）
  current: null,             // 当前账本详情
  status: 'idle',
  error: null,
  members: []                // 当前账本成员列表
};

/* ---------- Slice ---------- */
const ledgerSlice = createSlice({
  name: 'ledger',
  initialState,
  reducers: {
    // 切换账本
    setCurrentLedger(state, action) {
      state.currentId = action.payload;
      storage.set('currentLedgerId', action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // 1. 账本列表
      .addCase(loadLedgers.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadLedgers.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
        if (!state.currentId && action.payload.length) {
          state.currentId = action.payload[0].id;
          storage.set('currentLedgerId', state.currentId);
        }
      })
      .addCase(loadLedgers.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      })

      // 2. 某个账本详情
      .addCase(loadLedgerDetail.fulfilled, (state, action) => {
        state.current = action.payload;
      })

      // 3. 创建账本
      .addCase(createNewLedger.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })

      // 4. 更新账本
      .addCase(saveLedger.fulfilled, (state, action) => {
        const idx = state.items.findIndex(l => l.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
        if (state.current && state.current.id === action.payload.id) {
          state.current = action.payload;
        }
      })

      // 5. 删除/退出账本
      .addCase(removeLedger.fulfilled, (state, action) => {
        state.items = state.items.filter(l => l.id !== action.payload);
        if (state.currentId === action.payload) {
          state.currentId = null;
          state.current = null;
          storage.remove('currentLedgerId');
        }
      })
      .addCase(leaveLedgerAction.fulfilled, (state, action) => {
        // 从本地列表移除该账本，并清除当前选择
        state.items = state.items.filter(l => l.id !== action.payload);
        if (state.currentId === action.payload) {
          state.currentId = null;
          state.current = null;
          storage.remove('currentLedgerId');
        }
      })

      // 6. 成员管理
      .addCase(loadMembers.fulfilled, (state, action) => {
        state.members = action.payload;
      })
      .addCase(inviteLedgerMember.fulfilled, (state, action) => {
        // Server returns only a message; list will be refreshed by caller.
      })
      .addCase(changeMemberRole.fulfilled, (state, action) => {
        const { memberId, role } = action.meta.arg;
        const member = state.members.find(m => (m.id === memberId || m.member_id === memberId));
        if (member) member.role = role;
      })
      .addCase(deleteMember.fulfilled, (state, action) => {
        state.members = state.members.filter(m => (m.id !== action.payload && m.member_id !== action.payload));
      });
  },
});

export const { setCurrentLedger } = ledgerSlice.actions;
export default ledgerSlice.reducer;

// 选择器
export const selectLedgers = (state) => state.ledger.items;
export const selectCurrentLedgerId = (state) => state.ledger.currentId;
export const selectCurrentLedger = (state) => state.ledger.current;
export const selectLedgerMembers = (state) => state.ledger.members;
