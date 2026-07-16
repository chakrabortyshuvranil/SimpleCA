import ErrorNotice from "@/components/ErrorNotice";
import { getGeneralLedger } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

export default async function GeneralLedgerPage() {
  let accounts;

  try {
    accounts = await getGeneralLedger();
  } catch (error) {
    return (
      <ErrorNotice
        message={error instanceof Error ? error.message : "Unknown error"}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">General Ledger</h1>
      {accounts.map((account) => (
        <section key={account.code}>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-medium">{account.name}</h2>
            <span className="text-sm text-zinc-500">
              Balance: {formatCurrency(account.balance)}
            </span>
          </div>
          {account.postings.length === 0 ? (
            <p className="text-sm text-zinc-500">No postings yet.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left dark:border-white/15">
                  <th className="py-1.5 pr-4">Date</th>
                  <th className="py-1.5 pr-4">Description</th>
                  <th className="py-1.5 pr-4">Debit</th>
                  <th className="py-1.5 pr-4">Credit</th>
                </tr>
              </thead>
              <tbody>
                {account.postings.map((posting, i) => (
                  <tr
                    key={i}
                    className="border-b border-black/5 dark:border-white/10"
                  >
                    <td className="py-1.5 pr-4 whitespace-nowrap">
                      {posting.date}
                    </td>
                    <td className="py-1.5 pr-4">{posting.description}</td>
                    <td className="py-1.5 pr-4">
                      {posting.debit ? formatCurrency(posting.debit) : ""}
                    </td>
                    <td className="py-1.5 pr-4">
                      {posting.credit ? formatCurrency(posting.credit) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
