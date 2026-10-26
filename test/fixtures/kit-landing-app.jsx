// Sample landing page using the motion pieces sparingly, on real-looking content.
import React from 'react';
import { CalendarCheck, CreditCard, Plane, Receipt } from 'lucide-react';
import { AnimatedList, BentoCard, BentoGrid, BorderBeam, Marquee, NumberTicker, ShimmerButton } from './components/ui/motion.jsx';
import { Container, Section, Eyebrow } from './components/ui/section.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card.jsx';

const CITIES = ['Toronto', 'Montréal', 'Vancouver', 'Calgary', 'Ottawa', 'Halifax'];
const BOOKINGS = [
  { id: 'b1', who: 'Priya · Sales', what: 'YYZ → YVR, Tue 7:05' },
  { id: 'b2', who: 'Marc · Ops', what: 'Hotel in Calgary, 2 nights' },
  { id: 'b3', who: 'Lena · Finance', what: 'Receipt matched to policy' },
];

export default function App() {
  return (
    <main className="bg-background text-foreground">
      <Section>
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Eyebrow>Corporate travel for Canadian teams</Eyebrow>
            <h1 className="font-display text-5xl font-semibold tracking-tight">Book trips in minutes, inside your policy.</h1>
            <p className="max-w-xl text-lg text-muted-foreground">Flights, hotels and receipts in one place, with approvals that take one tap.</p>
            <div><ShimmerButton>Book a demo</ShimmerButton></div>
          </div>
          <AnimatedList delay={400} data-testid="live-bookings">
            {BOOKINGS.map((b) => (
              <Card key={b.id} className="w-full max-w-sm">
                <CardContent className="p-4">
                  <p className="font-medium">{b.who}</p>
                  <p className="text-sm text-muted-foreground">{b.what}</p>
                </CardContent>
              </Card>
            ))}
          </AnimatedList>
        </Container>
      </Section>
      <Section className="bg-muted/50">
        <Container className="flex flex-col gap-10">
          <p className="text-center text-sm text-muted-foreground">Sample data: <NumberTicker value={1240} data-testid="ticker" /> trips booked in this demo</p>
          <BentoGrid>
            <BentoCard className="lg:col-span-2" name="Flights and hotels" description="Search every airline and hotel your policy allows." icon={Plane} href="#book" cta="See booking" />
            <BentoCard name="Approvals" description="Managers approve from their phone." icon={CalendarCheck} />
            <BentoCard name="Receipts" description="Matched to each trip automatically." icon={Receipt} />
            <BentoCard className="lg:col-span-2" name="One company card" description="Pay centrally, report by team." icon={CreditCard} />
          </BentoGrid>
          <Marquee pauseOnHover data-testid="marquee">
            {CITIES.map((c) => (
              <span key={c} className="rounded-full border bg-card px-4 py-2 text-sm">{c}</span>
            ))}
          </Marquee>
          <Card className="relative mx-auto w-full max-w-sm overflow-hidden">
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <CardDescription>For companies with 50 to 500 people.</CardDescription>
            </CardHeader>
            <CardContent className="font-display text-4xl font-semibold">$12 <span className="text-base font-normal text-muted-foreground">per traveller a month</span></CardContent>
            <BorderBeam />
          </Card>
        </Container>
      </Section>
    </main>
  );
}
