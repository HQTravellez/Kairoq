// Sample CRM built only from the UI kit: KPIs, a deals pipeline, a customer table and a command menu.
import React from 'react';
import { Briefcase, LayoutDashboard, Plus, Users } from 'lucide-react';
import { StatCard, StatGrid } from './components/ui/stat-card.jsx';
import { Kanban } from './components/ui/kanban.jsx';
import { DataTable } from './components/ui/data-table.jsx';
import { CommandMenu } from './components/ui/command-menu.jsx';
import { Badge } from './components/ui/badge.jsx';
import { Button } from './components/ui/button.jsx';
import { Container } from './components/ui/section.jsx';
import { NumberTicker } from './components/ui/motion.jsx';

const STAGES = [
  { id: 'lead', title: 'Lead' },
  { id: 'demo', title: 'Demo booked' },
  { id: 'trial', title: 'Trial' },
  { id: 'won', title: 'Won' },
];

const START_DEALS = [
  { id: 'd1', column: 'lead', company: 'Northwind Logistics', value: 12000, owner: 'Ka' },
  { id: 'd2', column: 'lead', company: 'Maple Dental Group', value: 4800, owner: 'Sumeet' },
  { id: 'd3', column: 'demo', company: 'Harbour Insurance', value: 22000, owner: 'Ka' },
  { id: 'd4', column: 'trial', company: 'Lakeview Builders', value: 9500, owner: 'Joseph' },
  { id: 'd5', column: 'won', company: 'Credit Valley Clinics', value: 15000, owner: 'Ka' },
];

const CUSTOMERS = [
  { name: 'Credit Valley Clinics', city: 'Mississauga', status: 'Active', seats: 42 },
  { name: 'Harbour Insurance', city: 'Toronto', status: 'Trial', seats: 120 },
  { name: 'Lakeview Builders', city: 'Oakville', status: 'Trial', seats: 18 },
  { name: 'Northwind Logistics', city: 'Brampton', status: 'Lead', seats: 260 },
  { name: 'Maple Dental Group', city: 'Toronto', status: 'Lead', seats: 9 },
];

const money = (n) => '$' + n.toLocaleString('en-US');

export default function App() {
  const [deals, setDeals] = React.useState(START_DEALS);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pipeline = deals.filter((d) => d.column !== 'won').reduce((sum, d) => sum + d.value, 0);

  function handleMove(id, column) {
    setDeals((all) => all.map((d) => (d.id === id ? { ...d, column } : d)));
  }

  return (
    <main className="min-h-screen bg-background py-10 text-foreground">
      <Container className="flex flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Sales</h1>
          <Button variant="outline" onClick={() => setMenuOpen(true)}>Search ⌘K</Button>
        </header>
        <StatGrid>
          <StatCard label="Open pipeline" value={<NumberTicker value={pipeline} prefix="$" />} change={12.5} note="vs last month" />
          <StatCard label="Deals won" value={deals.filter((d) => d.column === 'won').length} change={4.2} note="this quarter" />
          <StatCard label="Customers" value={CUSTOMERS.length} icon={Users} note="in Ontario" />
          <StatCard label="Churn" value="1.8%" change={-0.6} goodWhen="down" note="monthly" />
        </StatGrid>
        <section aria-label="Pipeline" data-testid="pipeline">
          <Kanban
            columns={STAGES}
            items={deals}
            onMove={handleMove}
            columnTotal={(items) => money(items.reduce((s, d) => s + d.value, 0))}
            renderCard={(deal) => (
              <div className="flex flex-col gap-1">
                <p className="font-medium">{deal.company}</p>
                <p className="text-sm text-muted-foreground">{money(deal.value)} · {deal.owner}</p>
              </div>
            )}
          />
        </section>
        <section aria-label="Customers">
          <DataTable
            data={CUSTOMERS}
            searchPlaceholder="Search customers"
            filters={[{ key: 'status', label: 'Status' }]}
            pageSize={4}
            columns={[
              { key: 'name', header: 'Company' },
              { key: 'city', header: 'City' },
              { key: 'status', header: 'Status', cell: (row) => <Badge variant={row.status === 'Active' ? 'default' : 'secondary'}>{row.status}</Badge> },
              { key: 'seats', header: 'Seats', align: 'right' },
            ]}
          />
        </section>
      </Container>
      <CommandMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        items={[
          { label: 'Dashboard', group: 'Go to', icon: LayoutDashboard, onSelect: () => {} },
          { label: 'Deals', group: 'Go to', icon: Briefcase, onSelect: () => {} },
          { label: 'New deal', group: 'Actions', icon: Plus, shortcut: 'N', keywords: 'add create', onSelect: () => handleMove('d1', 'demo') },
        ]}
      />
    </main>
  );
}
