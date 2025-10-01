import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  loadLedgers,
  setCurrentLedger,
  selectLedgers,
} from "../features/ledger/ledgerSlice";
import { leaveLedgerAction } from "../features/ledger/ledgerSlice";
import { fetchLedgerDetail } from "../services/ledgers";
import DualBudgetBar from "../components/DualBudgetBar";
import BudgetAnalysisTable from "../components/BudgetAnalysisTable";
import Tag from "../components/Tag";
import { formatDateEN } from "../utils/date";

export default function LedgerList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const ledgers = useSelector(selectLedgers);
  const [expanded, setExpanded] = useState({}); // { [ledgerId]: true }
  const [details, setDetails] = useState({});  // { [ledgerId]: { totals, categories } }

  useEffect(() => {
    dispatch(loadLedgers());
  }, [dispatch]);

  const handleSelect = (id) => {
    dispatch(setCurrentLedger(id));
    navigate(`/ledgers/${id}`);
  };

  const toggleDetails = async (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    if (!details[id]) {
      try {
        const data = await fetchLedgerDetail(id);
        setDetails((prev) => ({ ...prev, [id]: data }));
      } catch (e) {
        // swallow for now; you may add toast
      }
    }
  };

  const handleLeave = async (id) => {
    await dispatch(leaveLedgerAction(id));
    await dispatch(loadLedgers());
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      {/* Page header */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Budgets</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track, manage and analyze your spending.
          </p>
        </div>
        <button
          onClick={() => navigate("/ledgers/new")}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <span className="text-lg leading-none">＋</span>
          Add Budget
        </button>
      </div>

      {/* Card container */}
      <div className="rounded-2xl bg-white/90 p-4 shadow ring-1 ring-black/5">
        {/* Table header (hidden on small screens) */}
        <div className="hidden grid-cols-12 gap-4 px-2 pb-3 text-xs font-medium uppercase tracking-wide text-gray-500 sm:grid">
          <div className="col-span-1">Link</div>
          <div className="col-span-4">Title</div>
          <div className="col-span-1">Role</div>
          <div className="col-span-2">Budget</div>
          <div className="col-span-2">Duration</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
        <div className="hidden h-px w-full bg-gray-200 sm:block" />

        {/* Rows */}
        {ledgers?.length ? (
          <ul className="divide-y divide-gray-100">
            {ledgers.map((l) => (
              <li
                key={l.id}
                className="grid grid-cols-1 items-center gap-3 px-2 py-4 transition-colors hover:bg-gray-50 sm:grid-cols-12 sm:gap-4"
              >
                {/* Link */}
                <div className="flex sm:col-span-1">
                  <button
                    onClick={() => handleSelect(l.id)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                    aria-label={`Open ${l.name}`}
                    title="Open"
                  >
                    🔗
                  </button>
                </div>

                {/* Title + meta */}
                <div className="sm:col-span-4">
                  <div className="text-sm font-medium text-gray-900">
                    {l.name}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {l.created_at ? (
                      <>Created {formatDateEN(l.created_at)}</>
                    ) : (
                      <>No created date</>
                    )}
                  </div>
                </div>

                {/* Role */}
                <div className="sm:col-span-1">
                  <button
                    onClick={() => { dispatch(setCurrentLedger(l.id)); navigate(`/ledgers/${l.id}/settings`); }}
                    title="Open settings"
                  >
                    <Tag color={l.myRole === 'owner' ? 'indigo' : l.myRole === 'editor' ? 'blue' : 'gray'}>
                      {l.myRole || 'viewer'}
                    </Tag>
                  </button>
                </div>

                {/* Budget */}
                <div className="sm:col-span-2 text-sm text-gray-900">
                  {typeof l.totalBudget === "number"
                    ? `$${l.totalBudget}`
                    : "—"}
                </div>

                {/* Duration (click to toggle inline analysis) */}
                <button
                  type="button"
                  onClick={() => toggleDetails(l.id)}
                  className="sm:col-span-2 text-left text-sm text-gray-900 underline decoration-dotted underline-offset-2 hover:text-blue-600"
                  title="View inline analysis"
                >
                  {l.durationText || "—"}
                </button>

                {/* Status */}
                <div className="sm:col-span-1">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                    Active
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 sm:col-span-1">
                  <button
                    onClick={() => navigate(`/ledgers/${l.id}/edit`)}
                    className={`h-9 w-9 rounded-lg ${l.myRole === 'viewer' ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                    aria-label="Edit"
                    title={l.myRole === 'viewer' ? 'Viewer cannot edit' : 'Edit'}
                    disabled={l.myRole === 'viewer'}
                  >
                    ✏️
                  </button>
                </div>
                {/* Inline analysis panel */}
                {expanded[l.id] && (
                  <div className="sm:col-span-12">
                    <div className="rounded-xl border border-gray-200 bg-white/70 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-900">Budget Overview</div>
                        <button
                          className="text-xs text-gray-500 hover:text-gray-700"
                          onClick={() => toggleDetails(l.id)}
                        >
                          Close
                        </button>
                      </div>
                      <DualBudgetBar
                        budget={details[l.id]?.totals?.budget || 0}
                        spending={details[l.id]?.totals?.spent || 0}
                      />
                      <BudgetAnalysisTable categories={details[l.id]?.categories || []} />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 text-5xl">🦖</div>
            <h2 className="text-lg font-semibold text-gray-900">
              No budgets yet
            </h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">
              Create your first budget to start tracking and analyzing your
              spending.
            </p>
            <button
              onClick={() => navigate("/ledgers/new")}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <span className="text-lg leading-none">＋</span>
              Create Budget
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
