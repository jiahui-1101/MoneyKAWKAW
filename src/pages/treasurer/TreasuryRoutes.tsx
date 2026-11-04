import { Link, Route, Routes } from 'react-router-dom';
import { TreasuryProvider } from '../../context/Treasury';
import { TreasuryShell } from '../../components/TreasuryShell';
import { Empty } from '../../components/ui';
import { TreasuryDashboard } from './Dashboard';
export function TreasuryRoutes() {
  return <TreasuryProvider><Routes><Route element={<TreasuryShell/>}>
    <Route index element={<TreasuryDashboard/>}/>
    <Route path="*" element={<Empty title="Financial workspace" action={<Link className="btn" to="/treasurer">Return to overview</Link>}>Choose a financial record from your navigation.</Empty>}/>
  </Route></Routes></TreasuryProvider>;
}
