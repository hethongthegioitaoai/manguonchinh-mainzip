import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RealtimeNotifications } from "@/components/RealtimeNotifications";
import { BackendStatusBanner } from "@/components/BackendStatusBanner";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import WorldsPage from "@/pages/WorldsPage";
import CharacterCreationPage from "@/pages/CharacterCreationPage";
import DashboardPage from "@/pages/DashboardPage";
import PlayPage from "@/pages/PlayPage";
import CharacterProfilePage from "@/pages/CharacterProfilePage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import BattlePage from "@/pages/BattlePage";
import BattleHistoryPage from "@/pages/BattleHistoryPage";
import InventoryPage from "@/pages/InventoryPage";
import SettingsPage from "@/pages/SettingsPage";
import CultivatePage from "@/pages/CultivatePage";
import GuildsPage from "@/pages/GuildsPage";
import GuildDetailPage from "@/pages/GuildDetailPage";
import MemoriesPage from "@/pages/MemoriesPage";
import WorldStatePage from "@/pages/WorldStatePage";
import SkillsPage from "@/pages/SkillsPage";
import FactionsPage from "@/pages/FactionsPage";
import MarketPage from "@/pages/MarketPage";
import AdminPage from "@/pages/AdminPage";
import NPCsPage from "@/pages/NPCsPage";
import WorldCreatorPage from "@/pages/WorldCreatorPage";
import WorldProfilePage from "@/pages/WorldProfilePage";
import MyWorldsPage from "@/pages/MyWorldsPage";
import CosmosPage from "@/pages/CosmosPage";
import WorldDiscoverPage from "@/pages/WorldDiscoverPage";
import MultiversePage from "@/pages/MultiversePage";
import PvPPage from "@/pages/PvPPage";
import AchievementsPage from "@/pages/AchievementsPage";
import DailyPage from "@/pages/DailyPage";
import DungeonPage from "@/pages/DungeonPage";
import CraftPage from "@/pages/CraftPage";
import GuildWarPage from "@/pages/GuildWarPage";
import FeedPage from "@/pages/FeedPage";
import GodModePage from "@/pages/GodModePage";
import WorldTradePage from "@/pages/WorldTradePage";
import WorldPassportPage from "@/pages/WorldPassportPage";
import ProphecyPage from "@/pages/ProphecyPage";
import IsekaiPage from "@/pages/IsekaiPage";
import FatePage from "@/pages/FatePage";
import AuctionPage from "@/pages/AuctionPage";
import TitlesPage from "@/pages/TitlesPage";
import PetsPage from "@/pages/PetsPage";
import WorldEconomyPage from "@/pages/WorldEconomyPage";
import DiplomacyPage from "@/pages/DiplomacyPage";
import WorldWarPage from "@/pages/WorldWarPage";
import WorldThemePage from "@/pages/WorldThemePage";
import GovernancePage from "@/pages/GovernancePage";
import DisastersPage from "@/pages/DisastersPage";
import BankPage from "@/pages/BankPage";
import BountiesPage from "@/pages/BountiesPage";
import TournamentPage from "@/pages/TournamentPage";
import RealEstatePage from "@/pages/RealEstatePage";
import WorldFairPage from "@/pages/WorldFairPage";
import CitizenshipPage from "@/pages/CitizenshipPage";
import ExpeditionPage from "@/pages/ExpeditionPage";
import WorldSkillsPage from "@/pages/WorldSkillsPage";
import LegendPage from "@/pages/LegendPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import WeatherPage from "@/pages/WeatherPage";
import WorldSimulationPage from "@/pages/WorldSimulationPage";
import NPCSimulationPage from "@/pages/NPCSimulationPage";
import NPCPopulationPage from "@/pages/NPCPopulationPage";
import NPCFactionPage from "@/pages/NPCFactionPage";
import TerritoryPage from "@/pages/TerritoryPage";
import NpcGovernmentPage from "@/pages/NpcGovernmentPage";
import NpcElectionPage from "@/pages/NpcElectionPage";
import CaravanPage from "@/pages/CaravanPage";
import LibraryPage from "@/pages/LibraryPage";
import FestivalPage from "@/pages/FestivalPage";
import DivineArenaPage from "@/pages/DivineArenaPage";
import NpcDiplomacyPage from "@/pages/NpcDiplomacyPage";
import MilitaryPage from "@/pages/MilitaryPage";
import NpcLongTermGoalsPage from "@/pages/NpcLongTermGoalsPage";
import NpcPlansPage from "@/pages/NpcPlansPage";
import NpcEmotionsPage from "@/pages/NpcEmotionsPage";
import PersonalityEvolutionPage from "@/pages/PersonalityEvolutionPage";
import NpcDialoguePage from "@/pages/NpcDialoguePage";
import NpcAgentPage from "@/pages/NpcAgentPage";
import WorldAnalyticsPage from "@/pages/WorldAnalyticsPage";
import PlayerAgentPage from "@/pages/PlayerAgentPage";
import StressTestPage from "@/pages/StressTestPage";
import WorldMapPage from "@/pages/WorldMapPage";
import PoliticalMapPage from "@/pages/PoliticalMapPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/worlds" component={WorldsPage} />
      <Route path="/create-character/:worldId" component={CharacterCreationPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/play" component={PlayPage} />
      <Route path="/character/:id" component={CharacterProfilePage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route path="/battle/history" component={BattleHistoryPage} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/battle" component={BattlePage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/cultivate" component={CultivatePage} />
      <Route path="/guilds" component={GuildsPage} />
      <Route path="/guilds/:id" component={GuildDetailPage} />
      <Route path="/memories" component={MemoriesPage} />
      <Route path="/world/:slug/state" component={WorldStatePage} />
      <Route path="/skills" component={SkillsPage} />
      <Route path="/factions" component={FactionsPage} />
      <Route path="/market" component={MarketPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/npcs" component={NPCsPage} />
      <Route path="/world-creator" component={WorldCreatorPage} />
      <Route path="/world-profile/:worldSlug" component={WorldProfilePage} />
      <Route path="/my-worlds" component={MyWorldsPage} />
      <Route path="/cosmos" component={CosmosPage} />
      <Route path="/world-discover" component={WorldDiscoverPage} />
      <Route path="/multiverse" component={MultiversePage} />
      <Route path="/pvp" component={PvPPage} />
      <Route path="/achievements" component={AchievementsPage} />
      <Route path="/daily" component={DailyPage} />
      <Route path="/dungeon" component={DungeonPage} />
      <Route path="/craft" component={CraftPage} />
      <Route path="/guild-war" component={GuildWarPage} />
      <Route path="/feed" component={FeedPage} />
      <Route path="/god" component={GodModePage} />
      <Route path="/god/:worldSlug" component={GodModePage} />
      <Route path="/world-trade" component={WorldTradePage} />
      <Route path="/passport" component={WorldPassportPage} />
      <Route path="/prophecy" component={ProphecyPage} />
      <Route path="/isekai" component={IsekaiPage} />
      <Route path="/fate" component={FatePage} />
      <Route path="/auction" component={AuctionPage} />
      <Route path="/titles" component={TitlesPage} />
      <Route path="/pets" component={PetsPage} />
      <Route path="/world-economy" component={WorldEconomyPage} />
      <Route path="/diplomacy" component={DiplomacyPage} />
      <Route path="/world-war" component={WorldWarPage} />
      <Route path="/world-theme" component={WorldThemePage} />
      <Route path="/governance" component={GovernancePage} />
      <Route path="/disasters" component={DisastersPage} />
      <Route path="/bank" component={BankPage} />
      <Route path="/bounties" component={BountiesPage} />
      <Route path="/tournament" component={TournamentPage} />
      <Route path="/realestate" component={RealEstatePage} />
      <Route path="/fair" component={WorldFairPage} />
      <Route path="/citizenship" component={CitizenshipPage} />
      <Route path="/expedition" component={ExpeditionPage} />
      <Route path="/world-skills" component={WorldSkillsPage} />
      <Route path="/legends" component={LegendPage} />
      <Route path="/weather" component={WeatherPage} />
      <Route path="/simulation" component={WorldSimulationPage} />
      <Route path="/npc-simulation" component={NPCSimulationPage} />
      <Route path="/npc-population" component={NPCPopulationPage} />
      <Route path="/npc-factions" component={NPCFactionPage} />
      <Route path="/territories" component={TerritoryPage} />
      <Route path="/npc-government" component={NpcGovernmentPage} />
      <Route path="/npc-elections" component={NpcElectionPage} />
      <Route path="/caravan" component={CaravanPage} />
      <Route path="/library" component={LibraryPage} />
      <Route path="/festival" component={FestivalPage} />
      <Route path="/divine-arena" component={DivineArenaPage} />
      <Route path="/npc-diplomacy" component={NpcDiplomacyPage} />
      <Route path="/military" component={MilitaryPage} />
      <Route path="/npc-goals" component={NpcLongTermGoalsPage} />
      <Route path="/npc-plans" component={NpcPlansPage} />
      <Route path="/npc-emotions" component={NpcEmotionsPage} />
      <Route path="/personality-evolution" component={PersonalityEvolutionPage} />
      <Route path="/npc-dialogue" component={NpcDialoguePage} />
      <Route path="/npc-agent" component={NpcAgentPage} />
      <Route path="/world-analytics" component={WorldAnalyticsPage} />
      <Route path="/player-agent" component={PlayerAgentPage} />
      <Route path="/stress-test" component={StressTestPage} />
      <Route path="/world-map" component={WorldMapPage} />
      <Route path="/political-map" component={PoliticalMapPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BackendStatusBanner />
          <RealtimeNotifications />
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
