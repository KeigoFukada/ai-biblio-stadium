import { Route, Switch } from "wouter";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import PresentationAssist from "@/pages/PresentationAssist";
import MockQA from "@/pages/MockQA";
import DreamMatch from "@/pages/DreamMatch";
import Battler from "@/pages/Battler";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/assist" component={PresentationAssist} />
      <Route path="/qa" component={MockQA} />
      <Route path="/dream" component={DreamMatch} />
      <Route path="/battler" component={Battler} />
      <Route>
        <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center text-white">
          <div className="text-center">
            <p className="text-6xl mb-4">404</p>
            <p className="text-slate-400">ページが見つかりません</p>
            <a href="/" className="mt-4 inline-block text-violet-400 hover:underline">ホームへ</a>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <>
      <Toaster theme="dark" position="top-center" />
      <Router />
    </>
  );
}
