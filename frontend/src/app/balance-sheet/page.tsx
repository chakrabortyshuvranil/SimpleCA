import ErrorNotice from "@/components/ErrorNotice";
import { getBalanceSheet } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { ChartAccount } from "@/lib/types";

function AccountSection({
  title,
  accounts,
  total,
}: {
  title: string;
  accounts: ChartAccount[];
  total: number;
}) {
  return (
    <section>
      <h2 className="mb-2 font-medium">{title}</h2>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {accounts.map((account) => (
            <tr
              key={account.code}
              className="border-b border-black/5 dark:border-white/10"
            >
              <td className="py-1.5 pr-4">{account.name}</td>
              <td className="py-1.5 text-right">
                {formatCurrency(account.balance)}
              </td>
            </tr>
          ))}
          <tr className="font-medium">
            <td className="py-1.5 pr-4">Total {title}</td>
            <td className="py-1.5 text-right">{formatCurrency(total)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

export default async function BalanceSheetPage() {
  let sheet;

  try {
    sheet = await getBalanceSheet();
  } catch (error) {
    return (
      <ErrorNotice
        message={error instanceof Error ? error.message : "Unknown error"}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Balance Sheet</h1>
      <AccountSection
        title="Assets"
        accounts={sheet.assets}
        total={sheet.totalAssets}
      />
      <AccountSection
        title="Liabilities"
        accounts={sheet.liabilities}
        total={sheet.totalLiabilities}
      />
      <AccountSection
        title="Equity"
        accounts={sheet.equity}
        total={sheet.totalEquity}
      />
      <div className="flex justify-between border-t border-black/10 pt-3 text-sm font-medium dark:border-white/15">
        <span>Total Liabilities + Equity</span>
        <span>
          {formatCurrency(sheet.totalLiabilities + sheet.totalEquity)}
        </span>
      </div>
    </div>
  );
}
