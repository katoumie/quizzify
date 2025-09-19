import Hero from "@/components/Hero";
import FlashcardsSection from "@/components/FlashcardsSection";
import LearnSection from "@/components/LearnSection";
import RewardsSection from "@/components/RewardsSection";
import QuizzifyInfo from "@/components/QuizzifyInfo";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <main className="bg-[#0a092d]">
      <Hero />
      <FlashcardsSection />
      <LearnSection />
      <RewardsSection />
      <QuizzifyInfo />
      <Footer />
    </main>
  );
}
