import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import SavingsCalculator from '../components/SavingsCalculator.jsx';
import { ClosingTrio } from '../components/Closing.jsx';

export default function Savings() {
  return (
    <>
      <section className="mx-auto max-w-[1280px] px-5 pb-12 pt-16 lg:px-8 lg:pt-24">
        <p className="tag">Savings calculator</p>
        <h1 className="mt-6 max-w-4xl text-balance font-display text-[42px] font-bold leading-[1] sm:text-[64px]">What is your travel programme actually costing you?</h1>
        <p className="mt-6 max-w-2xl text-lg text-[#5f646d]">Four inputs, run against our 2026 spend benchmark. The number appears on screen straight away, every assumption shown, nothing to fill in first.</p>
        <Link to="/demo" className="btn-ghost mt-8">Talk it through with us <ArrowRight size={15} /></Link>
      </section>
      <section className="mx-auto max-w-[1280px] px-5 pb-24 lg:px-8"><SavingsCalculator /></section>
      <ClosingTrio />
    </>
  );
}
