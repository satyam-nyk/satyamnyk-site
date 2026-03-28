'use client';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  faqs: FAQItem[];
}

export default function FAQSection({ faqs }: FAQSectionProps) {
  if (!faqs || faqs.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-8 shadow-[0_20px_70px_rgba(15,23,42,0.04)] md:rounded-3xl md:px-10 md:py-10">
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">
        Frequently Asked Questions
      </h2>

      <div className="mt-6 space-y-6 md:mt-8">
        {faqs.map((faq, idx) => (
          <div key={idx} className="border-b border-zinc-100 pb-6 last:border-b-0 last:pb-0">
            <h3 className="text-base font-semibold text-zinc-950 md:text-lg">
              {faq.question}
            </h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600 md:text-base md:leading-7">
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
