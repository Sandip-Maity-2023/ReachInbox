import { useState, useEffect, useCallback, useTransition } from 'react';
import { Navbar } from './components/Navbar';
import { StatsCards } from './components/StatsCards';
import { Tabs } from './components/Tabs';
import { SearchBar } from './components/SearchBar';
import { ScheduledTable } from './components/ScheduledTable';
import { SentTable } from './components/SentTable';
import { ComposeModal } from './components/ComposeModal';
import { SlackModal } from './components/SlackModal';
import { LoginCard } from './components/LoginCard';
import { api } from './api/client';
import type { EmailJob, EmailStats, SlackStatus, User, BulkSchedulePayload } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Dashboard Data State
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [slackStatus, setSlackStatus] = useState<SlackStatus>({ connected: false });

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSource, setSearchSource] = useState<string | null>(null);

  // UI States
  const [loading, setLoading] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Initial Authentication Check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('reachinbox_token');
        if (token) {
          const userData = await api.auth.getMe();
          setUser(userData);
        } else {
          // Automatic login to Demo User for seamless instant evaluation
          const data = await api.auth.loginDemo();
          setUser(data.user);
        }
      } catch (err) {
        localStorage.removeItem('reachinbox_token');
        setUser(null);
      } finally {
        setAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  // 2. Fetch Slack Status
  const fetchSlackStatus = useCallback(async () => {
    try {
      const status = await api.slack.getStatus();
      setSlackStatus(status);
    } catch (err) {
      // ignore
    }
  }, []);

  // 3. Fetch Dashboard Data
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (searchQuery.trim() !== '') {
        // Query via Elasticsearch Search API
        const searchRes = await api.emails.search(
          searchQuery,
          activeTab === 'scheduled' ? 'SCHEDULED' : 'SENT'
        );
        startTransition(() => {
          setSearchSource(searchRes.source);
          if (activeTab === 'scheduled') {
            setScheduledEmails(searchRes.emails);
          } else {
            setSentEmails(searchRes.emails);
          }
        });
      } else {
        setSearchSource(null);
        const [scheduledRes, sentRes, statsRes] = await Promise.all([
          api.emails.getScheduled(),
          api.emails.getSent(),
          api.emails.getStats(),
        ]);
        startTransition(() => {
          setScheduledEmails(scheduledRes.emails || []);
          setSentEmails(sentRes.emails || []);
          setStats(statsRes);
        });
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab, searchQuery]);

  // Fetch when user or tab changes
  useEffect(() => {
    if (user) {
      fetchData();
      fetchSlackStatus();
    }
  }, [user, activeTab, fetchData, fetchSlackStatus]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user) {
        fetchData();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, user, fetchData]);

  // Real-time polling every 4 seconds to observe delayed job transitions & completions
  useEffect(() => {
    if (!user || searchQuery.trim() !== '') return;
    const interval = setInterval(async () => {
      try {
        const [scheduledRes, sentRes, statsRes] = await Promise.all([
          api.emails.getScheduled(),
          api.emails.getSent(),
          api.emails.getStats(),
        ]);
        startTransition(() => {
          setScheduledEmails(scheduledRes.emails || []);
          setSentEmails(sentRes.emails || []);
          setStats(statsRes);
        });
      } catch (err) {
        // ignore polling error
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [user, searchQuery]);

  // Handle Logout
  const handleLogout = () => {
    api.auth.logout();
    setUser(null);
  };

  // Handle Cancel Email
  const handleCancelEmail = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled email?')) return;
    try {
      await api.emails.cancel(id);
      showToast('Scheduled email cancelled successfully');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel email');
    }
  };

  // Handle Schedule Bulk Submission
  const handleScheduleSubmit = async (payload: BulkSchedulePayload) => {
    setActionLoading(true);
    try {
      const res = await api.emails.scheduleBulk(payload);
      showToast(res.message || 'Emails scheduled successfully in BullMQ queue!');
      setIsComposeOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to schedule emails');
    } finally {
      setActionLoading(false);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0B0C0E] flex items-center justify-center text-zinc-400 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <span>Loading ReachInbox Scheduler...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginCard onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-[#0B0C0E] text-zinc-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        user={user}
        slackStatus={slackStatus}
        onOpenSlackModal={() => setIsSlackModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Metric Cards */}
        <StatsCards stats={stats} />

        {/* Action Tabs & Compose Button */}
        <Tabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenCompose={() => setIsComposeOpen(true)}
          onRefresh={fetchData}
          scheduledCount={stats?.db?.scheduled ?? scheduledEmails.length}
          sentCount={stats?.db?.sent ?? sentEmails.length}
          loading={loading}
        />

        {/* Elasticsearch Search Bar */}
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          searchSource={searchSource}
          placeholder={`Search ${activeTab === 'scheduled' ? 'scheduled' : 'sent'} emails by recipient, sender, subject...`}
        />

        {/* Active Tab View */}
        {activeTab === 'scheduled' ? (
          <ScheduledTable
            emails={scheduledEmails}
            loading={loading && scheduledEmails.length === 0}
            onCancel={handleCancelEmail}
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        ) : (
          <SentTable
            emails={sentEmails}
            loading={loading && sentEmails.length === 0}
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        )}
      </main>

      {/* Compose & Schedule Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSubmit={handleScheduleSubmit}
        loading={actionLoading}
      />

      {/* Slack Integration Modal */}
      <SlackModal
        isOpen={isSlackModalOpen}
        onClose={() => setIsSlackModalOpen(false)}
        status={slackStatus}
        onRefreshStatus={fetchSlackStatus}
      />
    </div>
  );
}
