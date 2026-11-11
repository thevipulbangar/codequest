import { PageTitle } from "@/components/ui";
import { WalletView } from "@/components/WalletView";

export default function OperatorWallet() {
  return <div className="max-w-5xl"><PageTitle title="Wallet" sub="Your credits, escrow and full transaction history." /><WalletView role="operator" /></div>;
}
