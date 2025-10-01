import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  selectCurrentLedgerId,
  selectCurrentLedger,
  selectLedgerMembers,
  loadMembers,
  inviteLedgerMember,
  changeMemberRole,
  deleteMember,
  saveLedger,
  removeLedger,
  loadLedgers,
} from "../features/ledger/ledgerSlice";
import { AuthContext } from "../context/authContext.jsx";
import { transferOwner } from "../services/ledgers";
import Tag from "../components/Tag";
import { leaveLedgerAction } from "../features/ledger/ledgerSlice";

export default function LedgerSettings() {
  const dispatch = useDispatch();
  const ledgerId = useSelector(selectCurrentLedgerId);
  const { id: routeId } = useParams();
  const navigate = useNavigate();

  const effectiveLedgerId = useMemo(
    () => ledgerId || (routeId ? Number(routeId) : null),
    [ledgerId, routeId]
  );

  const currentLedger = useSelector(selectCurrentLedger);
  const members = useSelector(selectLedgerMembers);
  const { currentUser } = useContext(AuthContext);

  const [name, setName] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [showTransfer, setShowTransfer] = useState(false);
  const [newOwnerMemberId, setNewOwnerMemberId] = useState("");

  useEffect(() => {
    if (effectiveLedgerId) dispatch(loadMembers(effectiveLedgerId));
  }, [effectiveLedgerId, dispatch]);

  useEffect(() => {
    if (currentLedger?.name) setName(currentLedger.name);
  }, [currentLedger]);

  // Ensure owner row is first
  const orderedMembers = useMemo(() => {
    const arr = Array.isArray(members) ? [...members] : [];
    arr.sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (b.role === "owner" && a.role !== "owner") return 1;
      const an = (a.username || "").toLowerCase();
      const bn = (b.username || "").toLowerCase();
      return an.localeCompare(bn);
    });
    return arr;
  }, [members]);

  const refreshMembers = () => {
    if (effectiveLedgerId) dispatch(loadMembers(effectiveLedgerId));
  };

  const handleInvite = async () => {
    if (!inviteUsername?.trim()) return;
    await dispatch(
      inviteLedgerMember({
        id: effectiveLedgerId,
        payload: { username: inviteUsername.trim(), role: inviteRole },
      })
    );
    setInviteUsername("");
    setInviteRole("viewer");
    refreshMembers();
  };

  const handleRole = async (memberId, role) => {
    await dispatch(changeMemberRole({ id: effectiveLedgerId, memberId, role }));
    refreshMembers();
  };

  const handleRemove = async (memberId) => {
    await dispatch(deleteMember({ id: effectiveLedgerId, memberId }));
    refreshMembers();
  };

  const handleRename = async () => {
    if (!name?.trim()) {
      window.alert('Name cannot be empty');
      return;
    }
    await dispatch(
      saveLedger({ id: effectiveLedgerId, changes: { name: name.trim() } })
    );
    // Show success popup in English, then go back to list and refresh
    window.alert('Rename successful');
    await dispatch(loadLedgers());
    navigate('/ledgers');
  };

  const handleDelete = async () => {
    await dispatch(removeLedger(effectiveLedgerId));
    await dispatch(loadLedgers());
    navigate("/ledgers");
  };

  const myMemberRow = useMemo(
    () => (members || []).find((m) => m.user_id === currentUser?.id) || null,
    [members, currentUser]
  );
  const myRole = myMemberRow?.role || 'viewer';
  const amOwner = myRole === "owner";
  const canRename = myRole === 'owner' || myRole === 'editor';
  const canManage = amOwner; // only owners manage membership

  const handleLeave = async () => {
    if (!myMemberRow) return;
    if (amOwner) {
      setShowTransfer(true);
      return;
    }
    // Optimistic update: remove from list and clear current
    await dispatch(leaveLedgerAction(effectiveLedgerId));
    // Refresh list from server to ensure consistency
    await dispatch(loadLedgers());
    navigate("/ledgers");
  };

  const confirmTransferAndLeave = async () => {
    if (!newOwnerMemberId) return;
    await transferOwner(effectiveLedgerId, Number(newOwnerMemberId));
    setShowTransfer(false);
    // After transferring, leave this ledger as well
    await dispatch(leaveLedgerAction(effectiveLedgerId));
    await dispatch(loadLedgers());
    navigate("/ledgers");
  };

  return (
    <>
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Ledger Settings</h1>

        {/* Rename ledger */}
        <div className="mb-8 rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
          <div className="mb-3 text-sm font-medium text-gray-700">Rename Ledger</div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ledger name"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              disabled={!canRename}
            />
            <button
              onClick={handleRename}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={!canRename}
            >
              Save
            </button>
          </div>
          {!canRename && (
            <div className="mt-2 text-xs text-gray-500">Only owner or editor can rename.</div>
          )}
        </div>

        {/* Members list */}
        <div className="mb-8 rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
          <div className="mb-3 text-sm font-medium text-gray-700">Members</div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-0">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {orderedMembers.map((m) => (
                  <tr key={m.member_id} className="border-t border-gray-200">
                    <td className="px-3 py-3 font-medium text-gray-900">{m.username}</td>
                    <td className="px-3 py-3 text-gray-600">{m.email}</td>
                    <td className="px-3 py-3">
                      {m.role === "owner" ? (
                        <Tag color="indigo" size="sm">owner</Tag>
                      ) : (
                        <select
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-60"
                          value={m.role}
                          onChange={(e) => handleRole(m.member_id, e.target.value)}
                          disabled={!canManage}
                        >
                          <option value="editor">editor</option>
                          <option value="viewer">viewer</option>
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {m.role !== "owner" && (
                        <button
                          className="rounded-lg px-3 py-1 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                          onClick={() => handleRemove(m.member_id)}
                          disabled={!canManage || m.user_id === currentUser?.id}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {(!orderedMembers || orderedMembers.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-3 py-5 text-center text-sm text-gray-500">
                      No members yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Invite */}
          <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder="Username to invite"
              className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              disabled={!canManage}
            />
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              disabled={!canManage}
            >
              <option value="viewer">viewer</option>
              <option value="editor">editor</option>
            </select>
            <button
              onClick={handleInvite}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={!canManage || !inviteUsername?.trim()}
            >
              Invite Member
            </button>
          </div>
          {!amOwner && (
            <div className="mt-2 text-xs text-gray-500">Only owners can invite or change roles.</div>
          )}
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <div className="mb-2 text-sm font-semibold text-rose-800">Danger Zone</div>
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm text-rose-700 hover:bg-rose-50"
              onClick={handleLeave}
            >
              Leave Ledger
            </button>
            {amOwner && (
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                onClick={handleDelete}
              >
                Delete Ledger
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transfer Ownership Modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
            <div className="mb-3 text-base font-semibold text-gray-900">Transfer Ownership</div>
            <p className="mb-4 text-sm text-gray-600">Select the next owner before you leave this ledger.</p>
            <select
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={newOwnerMemberId}
              onChange={(e) => setNewOwnerMemberId(e.target.value)}
            >
              <option value="">Select member</option>
              {(orderedMembers || [])
                .filter((m) => m.member_id !== myMemberRow?.member_id)
                .map((m) => (
                  <option key={m.member_id} value={m.member_id}>
                    {m.username} ({m.role})
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                onClick={() => setShowTransfer(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                onClick={confirmTransferAndLeave}
                disabled={!newOwnerMemberId}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
