import AppLayout from "@/components/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Admin from "@/pages/Admin";
import CalendarView from "@/pages/CalendarView";
import Coach from "@/pages/Coach";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/NotFound";
import Pending from "@/pages/Pending";
import Profile from "@/pages/Profile";
import Register from "@/pages/Register";
import Rejected from "@/pages/Rejected";
import RideDetail from "@/pages/RideDetail";
import RideList from "@/pages/RideList";
import RideUpload from "@/pages/RideUpload";
import Schedules from "@/pages/Schedules";
import Stats from "@/pages/Stats";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/register" component={Register} />
      <Route path="/pending" component={Pending} />
      <Route path="/rejected" component={Rejected} />
      <Route path="/profile" component={Profile} />
      <Route path="/rides/upload" component={RideUpload} />
      <Route path="/rides/:id" component={RideDetail} />
      <Route path="/rides" component={RideList} />
      <Route path="/calendar" component={CalendarView} />
      <Route path="/stats" component={Stats} />
      <Route path="/coach" component={Coach} />
      <Route path="/schedules" component={Schedules} />
      <Route path="/admin" component={Admin} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AppLayout>
            <Router />
          </AppLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
