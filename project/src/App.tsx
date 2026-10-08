import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  CircleHelp,
  Eye,
  EyeOff,
  FileCheck2,
  Globe2,
  GraduationCap,
  Home,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  Mic,
  Play,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  getLocalSession,
  isSupabaseConfigured,
  signInLocalAccount,
  signOutLocalAccount,
  signUpLocalAccount,
  supabase,
} from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

type View = 'home' | 'journey' | 'video' | 'admin';
type JourneyStage = 'overview' | 'profile' | 'documents' | 'qualification' | 'pathway';

type Application = {
  name: string;
  goal: string;
  city: string;
  focus: string;
  education: string;
  germanLevel: string;
  itExperience: string;
  interests: string;
  futureGoal: string;
  completion: number;
  status: string;
  reviewStatus: 'pending' | 'accepted' | 'rejected';
  reviewNote: string;
  lastUpdated: string;
};

type VideoAnalysis = {
  transcript: string;
  summary: string;
  highlights: string[];
  speakingTips: string[];
  profileComparisons?: ProfileComparison[];
};

type ProfileComparison = {
  field: 'education' | 'germanLevel' | 'itExperience' | 'interests' | 'futureGoal';
  profileValue: string;
  spokenEvidence: string;
  status: 'consistent' | 'possible_mismatch' | 'not_mentioned' | 'unclear';
  explanation: string;
};

type DocumentAnalysis = {
  documentTypeMatch: boolean;
  readable: boolean;
  summary: string;
  extractedFacts: string[];
  issues: string[];
};

type ApplicantDocument = {
  id: string;
  user_id: string;
  document_type: 'english_test' | 'ielts' | 'degree' | 'other';
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  ai_analysis: DocumentAnalysis | null;
  uploaded_at: string;
};

type CvDraft = { cvText: string; improvementTips: string[]; generatedAt: string };

type AdminApplication = Pick<Application, 'name' | 'goal' | 'completion' | 'status' | 'lastUpdated' | 'reviewStatus'>;

type AdminReviewRecord = AdminApplication & {
  id: string;
  userId: string;
  city: string;
  reviewStatus: 'pending' | 'accepted' | 'rejected';
  reviewNote: string;
  profileData: Record<string, unknown>;
  documents: ApplicantDocument[];
};

const applicationSeed: Application = {
  name: '',
  goal: 'IT / Software Ausbildung',
  city: 'Berlin',
  focus: 'Vocational training',
  education: '',
  germanLevel: '',
  itExperience: '',
  interests: '',
  futureGoal: '',
  completion: 0,
  status: 'Profile not started',
  reviewStatus: 'pending' as const,
  reviewNote: '',
  lastUpdated: '',
};

function isVideoAnalysis(value: unknown): value is VideoAnalysis {
  if (!value || typeof value !== 'object') return false;
  const analysis = value as Partial<VideoAnalysis>;
  return typeof analysis.transcript === 'string'
    && typeof analysis.summary === 'string'
    && isStringArray(analysis.highlights)
    && isStringArray(analysis.speakingTips)
    && (analysis.profileComparisons === undefined || (
      Array.isArray(analysis.profileComparisons)
      && analysis.profileComparisons.every((item) => item
        && ['education', 'germanLevel', 'itExperience', 'interests', 'futureGoal'].includes(item.field)
        && typeof item.profileValue === 'string'
        && typeof item.spokenEvidence === 'string'
        && ['consistent', 'possible_mismatch', 'not_mentioned', 'unclear'].includes(item.status)
        && typeof item.explanation === 'string')
    ));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function localApplicationKey(userId: string) {
  return `educaro-application-${userId}`;
}

function readLocalApplication(userId: string, displayName: string): Application {
  const raw = localStorage.getItem(localApplicationKey(userId));
  if (!raw) return { ...applicationSeed, name: displayName };

  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Saved applicant profile is invalid.');
  }

  const saved = value as Partial<Application>;
  return {
    ...applicationSeed,
    name: typeof saved.name === 'string' ? saved.name : displayName,
    goal: typeof saved.goal === 'string' ? saved.goal : applicationSeed.goal,
    city: typeof saved.city === 'string' ? saved.city : applicationSeed.city,
    focus: typeof saved.focus === 'string' ? saved.focus : applicationSeed.focus,
    education: typeof saved.education === 'string' ? saved.education : '',
    germanLevel: typeof saved.germanLevel === 'string' ? saved.germanLevel : '',
    itExperience: typeof saved.itExperience === 'string' ? saved.itExperience : '',
    interests: typeof saved.interests === 'string' ? saved.interests : '',
    futureGoal: typeof saved.futureGoal === 'string' ? saved.futureGoal : '',
    completion: typeof saved.completion === 'number' ? saved.completion : 0,
    status: typeof saved.status === 'string' ? saved.status : applicationSeed.status,
    reviewStatus: saved.reviewStatus === 'accepted' || saved.reviewStatus === 'rejected' ? saved.reviewStatus : 'pending',
    reviewNote: typeof saved.reviewNote === 'string' ? saved.reviewNote : '',
    lastUpdated: typeof saved.lastUpdated === 'string' ? saved.lastUpdated : '',
  };
}

function profileIsComplete(application: Application) {
  const name = application.name.trim();
  const experience = application.itExperience.trim();
  const interests = application.interests.trim();
  const futureGoal = application.futureGoal.trim();
  return name.length >= 2 && name.length <= 100
    && ['Secondary school', 'Vocational qualification', 'Some college or university', 'Bachelor’s degree', 'Other / still studying'].includes(application.education)
    && ['No German yet', 'A1', 'A2', 'B1', 'B2', 'C1 or above', 'Not sure'].includes(application.germanLevel)
    && experience.length >= 3 && experience.length <= 1000
    && interests.length >= 15 && interests.length <= 1000
    && futureGoal.length >= 15 && futureGoal.length <= 1000;
}

const journeySteps = [
  { id: 'profile' as JourneyStage, label: 'Your profile', meta: 'Personal & goals', icon: Users },
  { id: 'documents' as JourneyStage, label: 'Documents', meta: 'Upload for review', icon: FileCheck2 },
  { id: 'qualification' as JourneyStage, label: 'Speech feedback', meta: 'Optional coaching', icon: BadgeCheck },
  { id: 'pathway' as JourneyStage, label: 'Your pathway', meta: 'Coming next', icon: GraduationCap },
];

function App() {
  const [view, setView] = useState<View>('home');
  const [journeyStage, setJourneyStage] = useState<JourneyStage>('overview');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'admin'>('signin');
  const [authInitialError, setAuthInitialError] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'applicant' | null>(null);
  const viewRef = useRef<View>(view);
  const resolvedRoleUserId = useRef<string | null>(null);
  viewRef.current = view;
  const [application, setApplication] = useState(applicationSeed);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null);
  const [documents, setDocuments] = useState<ApplicantDocument[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [documentsLoadError, setDocumentsLoadError] = useState('');
  const [cvDraft, setCvDraft] = useState<CvDraft | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('educaro-theme') === 'dark');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const localSession = getLocalSession();
      setSession(localSession);
      setUserRole(localSession ? 'applicant' : null);
      return;
    }

    let mounted = true;
    const resolveAccountRole = async (accountSession: Session) => {
      if (resolvedRoleUserId.current === accountSession.user.id) return;
      const { data, error } = await supabase.functions.invoke('resolve-account-role', { body: {} });
      if (!mounted) return;
      if (error || (data?.role !== 'admin' && data?.role !== 'applicant')) {
        console.error('verified account role could not be resolved', error);
        setUserRole(null);
        if (error?.status === 404) {
          setAuthMode('signin');
          setAuthInitialError('Account access is temporarily unavailable because the Supabase role-verification function has not been deployed.');
          setAuthOpen(true);
        }
        return;
      }
      resolvedRoleUserId.current = accountSession.user.id;
      setUserRole(data.role);
      if (data.role === 'admin' && viewRef.current === 'home') setView('admin');
    };
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('auth session restore failed', error);
      if (mounted) {
        setSession(data.session);
        if (data.session) void resolveAccountRole(data.session);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) resolvedRoleUserId.current = null;
      if (resolvedRoleUserId.current !== nextSession?.user.id) setUserRole(null);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('educaro-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (!session) {
      setApplication(applicationSeed);
      setVideoAnalysis(null);
      setDocuments([]);
      setDocumentsLoaded(false);
      setDocumentsLoadError('');
      setCvDraft(null);
      return;
    }
    const displayName = session.user.user_metadata.display_name;
    const name = typeof displayName === 'string' ? displayName : '';
    setApplication({ ...applicationSeed, name });
    setVideoAnalysis(null);
    setDocuments([]);
    setDocumentsLoaded(false);
    setDocumentsLoadError('');
    setCvDraft(null);
    if (!isSupabaseConfigured) {
      try {
        setApplication(readLocalApplication(session.user.id, name));
      } catch (error) {
        console.error('local application load failed', error);
      }
      return;
    }

    let mounted = true;
    supabase.from('applications').select('name, goal, city, focus, completion, status, review_status, review_note, updated_at, profile_data').eq('user_id', session.user.id).maybeSingle().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.error('application load failed', error);
        return;
      }
      if (data) {
        const profile = data.profile_data && typeof data.profile_data === 'object' ? data.profile_data as Record<string, unknown> : {};
        const nextApplication: Application = {
          ...applicationSeed,
          name: data.name ?? applicationSeed.name,
          goal: typeof data.goal === 'string' && data.goal ? data.goal : applicationSeed.goal,
          city: data.city ?? applicationSeed.city,
          focus: data.focus ?? applicationSeed.focus,
          education: typeof profile.education === 'string' ? profile.education : '',
          germanLevel: typeof profile.germanLevel === 'string' ? profile.germanLevel : '',
          itExperience: typeof profile.itExperience === 'string' ? profile.itExperience : '',
          interests: typeof profile.interests === 'string' ? profile.interests : '',
          futureGoal: typeof profile.futureGoal === 'string' ? profile.futureGoal : '',
          completion: 0,
          status: data.status ?? applicationSeed.status,
          reviewStatus: data.review_status === 'accepted' || data.review_status === 'rejected' ? data.review_status : 'pending',
          reviewNote: data.review_note ?? '',
          lastUpdated: data.updated_at ?? applicationSeed.lastUpdated,
        };
        nextApplication.completion = profileIsComplete(nextApplication) ? 60 : 0;
        setApplication(nextApplication);
        if (isVideoAnalysis(profile.videoAnalysis)) setVideoAnalysis(profile.videoAnalysis);
        if (profile.cvDraft && typeof profile.cvDraft === 'object' && !Array.isArray(profile.cvDraft)) {
          const cv = profile.cvDraft as Partial<CvDraft>;
          if (typeof cv.cvText === 'string' && isStringArray(cv.improvementTips) && typeof cv.generatedAt === 'string') {
            setCvDraft({ cvText: cv.cvText, improvementTips: cv.improvementTips, generatedAt: cv.generatedAt });
          }
        }
      }
    });
    return () => { mounted = false; };
  }, [session]);

  useEffect(() => {
    if (!session || view !== 'journey' || journeyStage !== 'documents' || documentsLoaded) return;
    if (!isSupabaseConfigured) {
      setDocumentsLoaded(true);
      return;
    }

    let mounted = true;
    supabase.from('applicant_documents')
      .select('id, user_id, document_type, storage_path, file_name, mime_type, file_size, ai_analysis, uploaded_at')
      .eq('user_id', session.user.id)
      .order('uploaded_at', { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error('applicant documents load failed', error);
          setDocumentsLoadError('Your documents could not be loaded. Please try again.');
        } else {
          setDocuments(data?.map((document) => ({
            ...document,
            ai_analysis: document.ai_analysis && typeof document.ai_analysis === 'object' ? document.ai_analysis as DocumentAnalysis : null,
          })) ?? []);
          setDocumentsLoadError('');
        }
        setDocumentsLoaded(true);
      });
    return () => { mounted = false; };
  }, [session, view, journeyStage, documentsLoaded]);

  const goTo = (nextView: View, stage: JourneyStage = 'overview') => {
    if ((nextView === 'journey' || nextView === 'video') && !session) { setAuthMode('signin'); setAuthOpen(true); return; }
    if (nextView === 'admin' && userRole !== 'admin') { setAuthMode('admin'); setAuthOpen(true); return; }
    setView(nextView); setJourneyStage(stage); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateApplication = async (nextApplication: Application) => {
    const changedReviewInputs = ['name', 'goal', 'city', 'education', 'germanLevel', 'itExperience', 'interests', 'futureGoal']
      .some((field) => nextApplication[field as keyof Application] !== application[field as keyof Application]);
    const changedSpeechInputs = ['goal', 'education', 'germanLevel', 'itExperience', 'interests', 'futureGoal']
      .some((field) => nextApplication[field as keyof Application] !== application[field as keyof Application]);
    const changedCvInputs = ['name', 'goal', 'city', 'education', 'germanLevel', 'itExperience', 'interests', 'futureGoal']
      .some((field) => nextApplication[field as keyof Application] !== application[field as keyof Application]);
    const nextAnalysis = changedSpeechInputs ? null : videoAnalysis;
    const savedApplication = {
      ...nextApplication,
      completion: profileIsComplete(nextApplication) ? 60 : 0,
      status: profileIsComplete(nextApplication) ? 'Profile ready for video' : 'Profile in progress',
      reviewStatus: changedReviewInputs ? 'pending' as const : application.reviewStatus,
      reviewNote: changedReviewInputs ? '' : application.reviewNote,
      lastUpdated: new Date().toISOString(),
    };
    const nextCvDraft = changedCvInputs ? null : cvDraft;
    if (!session) {
      setApplication(savedApplication);
      setCvDraft(nextCvDraft);
      if (changedSpeechInputs) setVideoAnalysis(null);
      return;
    }
    if (!isSupabaseConfigured) {
      localStorage.setItem(localApplicationKey(session.user.id), JSON.stringify(savedApplication));
      setApplication(savedApplication);
      setCvDraft(nextCvDraft);
      if (changedSpeechInputs) setVideoAnalysis(null);
      return;
    }
    const profileData = {
      education: savedApplication.education,
      germanLevel: savedApplication.germanLevel,
      itExperience: savedApplication.itExperience,
      interests: savedApplication.interests,
      futureGoal: savedApplication.futureGoal,
      videoAnalysis: nextAnalysis,
      cvDraft: nextCvDraft,
    };
    const { error } = await supabase.from('applications').upsert({
      user_id: session.user.id,
      name: savedApplication.name,
      goal: savedApplication.goal,
      city: savedApplication.city,
      focus: savedApplication.focus,
      profile_data: profileData,
      completion: savedApplication.completion,
      status: savedApplication.status,
      review_status: savedApplication.reviewStatus,
      review_note: savedApplication.reviewNote || null,
      updated_at: savedApplication.lastUpdated,
    }, { onConflict: 'user_id' });
    if (error) {
      console.error('application save failed', error);
      throw error;
    }
    setApplication(savedApplication);
    setCvDraft(nextCvDraft);
    if (changedSpeechInputs) setVideoAnalysis(null);
  };

  const saveVideoPath = async (path: string) => {
    if (!session) throw new Error('Sign in before saving a video.');
    if (!isSupabaseConfigured) throw new Error('Secure video storage is unavailable until Supabase is configured.');
    const { error } = await supabase.from('applications').upsert({
      user_id: session.user.id,
      name: application.name,
      goal: application.goal,
      city: application.city,
      focus: application.focus,
      profile_data: {
        education: application.education,
        germanLevel: application.germanLevel,
        itExperience: application.itExperience,
        interests: application.interests,
        futureGoal: application.futureGoal,
        videoAnalysis: null,
        cvDraft,
      },
      video_path: path,
      completion: application.completion,
      status: 'Video received',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) {
      console.error('video record save failed', error);
      throw error;
    }
    setVideoAnalysis(null);
    setApplication((current) => ({ ...current, status: 'Video received', reviewStatus: 'pending', reviewNote: '' }));
  };

  const handleAnalysis = async (analysis: VideoAnalysis) => {
    if (!session || !isSupabaseConfigured) {
      throw new Error('A configured Supabase account is required to save speech feedback.');
    }
    const reviewedApplication = {
      ...application,
      completion: 60,
      status: 'Speech feedback ready',
      reviewStatus: 'pending' as const,
      reviewNote: '',
      lastUpdated: new Date().toISOString(),
    };
    const profileData = {
      education: reviewedApplication.education,
      germanLevel: reviewedApplication.germanLevel,
      itExperience: reviewedApplication.itExperience,
      interests: reviewedApplication.interests,
      futureGoal: reviewedApplication.futureGoal,
      videoAnalysis: analysis,
      cvDraft,
    };
    const { error } = await supabase.from('applications').upsert({
      user_id: session.user.id,
      name: reviewedApplication.name,
      goal: reviewedApplication.goal,
      city: reviewedApplication.city,
      focus: reviewedApplication.focus,
      profile_data: profileData,
      completion: reviewedApplication.completion,
      status: reviewedApplication.status,
      updated_at: reviewedApplication.lastUpdated,
    }, { onConflict: 'user_id' });
    if (error) {
      console.error('speech feedback save failed', error);
      throw error;
    }
    setVideoAnalysis(analysis);
    setApplication(reviewedApplication);
  };

  const refreshDocuments = async () => {
    if (!session || !isSupabaseConfigured) return;
    const [{ data, error }, { data: latestApplication, error: applicationError }] = await Promise.all([
      supabase.from('applicant_documents')
        .select('id, user_id, document_type, storage_path, file_name, mime_type, file_size, ai_analysis, uploaded_at')
        .eq('user_id', session.user.id)
        .order('uploaded_at', { ascending: false }),
      supabase.from('applications').select('status, review_status, review_note').eq('user_id', session.user.id).maybeSingle(),
    ]);
    if (error || applicationError) {
      console.error('applicant documents or application refresh failed', error ?? applicationError);
      setDocumentsLoadError('Your documents could not be refreshed. Please try again.');
      throw error ?? applicationError;
    }
    if (latestApplication) {
      setApplication((current) => ({
        ...current,
        status: latestApplication.status,
        reviewStatus: latestApplication.review_status === 'accepted' || latestApplication.review_status === 'rejected' ? latestApplication.review_status : 'pending',
        reviewNote: latestApplication.review_note ?? '',
      }));
    }
    setCvDraft(null);
    setDocuments((data ?? []).map((document) => ({
      ...document,
      ai_analysis: document.ai_analysis && typeof document.ai_analysis === 'object' ? document.ai_analysis as DocumentAnalysis : null,
    })));
    setDocumentsLoaded(true);
    setDocumentsLoadError('');
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      await signOutLocalAccount();
      setView('home');
      setSession(null);
      setUserRole(null);
      return;
    }

    await supabase.auth.signOut();
    setView('home');
    setSession(null);
    setUserRole(null);
    resolvedRoleUserId.current = null;
  };

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => goTo('home')} aria-label="Educaro home"><span className="brand-mark"><span /></span><span>educaro<span className="brand-dot">.</span></span></button>
      <nav className={mobileMenu ? 'nav-links open' : 'nav-links'}><button className={view === 'home' ? 'active' : ''} onClick={() => goTo('home')}>How it works</button><button onClick={() => goTo('journey')}>My journey</button><button onClick={() => goTo('home')}>Germany guide</button></nav>
      <div className="topbar-actions"><button className="theme-toggle" onClick={() => setDarkMode((value) => !value)} aria-label="Toggle dark mode">{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button>{userRole !== 'admin' && <button className="admin-link" onClick={() => { setAuthMode('admin'); setAuthOpen(true); }}><LockKeyhole size={15} /> Admin access</button>}{session && <button className="avatar-button" onClick={() => goTo(userRole === 'admin' ? 'admin' : 'journey')}>{(session.user.email?.slice(0, 2) || 'AM').toUpperCase()}</button>}{session && <button className="signout-button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out"><LogOut size={16} /><span>Sign out</span></button>}<button className="menu-button" onClick={() => setMobileMenu((value) => !value)} aria-label="Toggle navigation">{mobileMenu ? <X size={20} /> : <Menu size={20} />}</button></div>
    </header>
    {view === 'home' && <HomeView onStart={() => goTo('journey')} onVideo={() => goTo('video')} />}
    {view === 'journey' && <JourneyView application={application} stage={journeyStage} analysis={videoAnalysis} documents={documents} documentsLoaded={documentsLoaded} documentsLoadError={documentsLoadError} cvDraft={cvDraft} session={session} onStage={setJourneyStage} onVideo={() => goTo('video')} onUpdate={updateApplication} onDocumentsChanged={refreshDocuments} onCvGenerated={setCvDraft} />}
    {view === 'video' && <VideoView session={session} application={application} onBack={() => goTo('journey')} onProfile={() => goTo('journey', 'profile')} onSaveVideo={saveVideoPath} onAnalysis={handleAnalysis} onComplete={() => goTo('journey', 'qualification')} />}
    {view === 'admin' && userRole === 'admin' && <AdminWorkspace onSignOut={() => void signOut()} />}
    <footer className="footer"><div className="footer-brand"><span className="brand-mark small"><span /></span><span>educaro<span className="brand-dot">.</span></span></div><p>One clear next step for your Germany journey.</p><div className="footer-links"><button>Privacy</button><button>Security</button><button>Help centre</button></div></footer>
    {authOpen && <ApplicantAuth initialMode={authMode} initialError={authInitialError} onClose={() => { setAuthOpen(false); setAuthInitialError(''); }} onSuccess={(role, userId) => { setAuthOpen(false); setAuthInitialError(''); setUserRole(role); if (userId) resolvedRoleUserId.current = userId; if (!isSupabaseConfigured) setSession(getLocalSession()); setView(role === 'admin' ? 'admin' : 'journey'); }} />}
  </div>;
}

function HomeView({ onStart, onVideo }: { onStart: () => void; onVideo: () => void }) {
  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> Your Germany journey, made clear</div>
          <h1>Turn your ambition into <em>a clear next step.</em></h1>
          <p className="hero-description">Educaro brings your documents, goals, and possibilities together — then guides you forward with an AI companion that understands your story.</p>
          <div className="hero-actions"><button className="button primary" onClick={onStart}>Start your journey <ArrowRight size={17} /></button><button className="button secondary" onClick={onVideo}><Play size={16} /> See how it works</button></div>
          <div className="trust-row"><div className="trust-avatars"><span>AK</span><span>SM</span><span>JT</span><span>+</span></div><span>Join 2,400+ applicants building their future</span></div>
        </div>
        <div className="hero-orbit" aria-hidden="true"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><Globe2 size={70} strokeWidth={1.2} /><span>Germany<br /><b>is closer</b></span></div><div className="orbit-chip chip-top"><ShieldCheck size={15} /> Clear pathway</div><div className="orbit-chip chip-bottom"><Sparkles size={15} /> AI-guided</div></div>
      </section>
      <section className="promise-section">
        <div className="section-label">A smarter way forward</div><h2>Not another checklist.<br /><span>A companion for the whole journey.</span></h2>
        <div className="promise-grid"><PromiseCard icon={<Sparkles />} number="01" title="Understand your story" body="Tell us where you want to go. Educaro learns your goals, experience, and the kind of future you’re building." /><PromiseCard icon={<FileCheck2 />} number="02" title="Make your profile ready" body="Upload what you have. We extract the important details, highlight gaps, and help you get every detail right." /><PromiseCard icon={<ArrowRight />} number="03" title="Move with confidence" body="Get a clear qualification outcome and a practical plan for where to stay, eat, and start well in Germany." /></div>
      </section>
      <section className="feature-banner"><div><div className="eyebrow">Built around you</div><h2>Human clarity.<br /><em>Intelligent guidance.</em></h2></div><div className="feature-banner-side"><p>Every recommendation is grounded in the information you provide. No guesswork. No generic answers.</p><button className="text-link" onClick={onStart}>Explore your journey <ChevronRight size={16} /></button></div></section>
    </main>
  );
}

function PromiseCard({ icon, number, title, body }: { icon: ReactNode; number: string; title: string; body: string }) {
  return <article className="promise-card"><div className="card-top"><div className="promise-icon">{icon}</div><span>{number}</span></div><h3>{title}</h3><p>{body}</p><div className="card-line" /></article>;
}

function JourneyView({ application, stage, onStage, onVideo, onUpdate, analysis, documents, documentsLoaded, documentsLoadError, cvDraft, session, onDocumentsChanged, onCvGenerated }: { application: Application; stage: JourneyStage; onStage: (stage: JourneyStage) => void; onVideo: () => void; onUpdate: (application: Application) => Promise<void>; analysis: VideoAnalysis | null; documents: ApplicantDocument[]; documentsLoaded: boolean; documentsLoadError: string; cvDraft: CvDraft | null; session: Session | null; onDocumentsChanged: () => Promise<void>; onCvGenerated: (draft: CvDraft) => void }) {
  const stageTitle = stage === 'overview' ? `Good morning, ${application.name.split(' ')[0] || 'there'}.` : journeySteps.find((step) => step.id === stage)?.label ?? 'Your journey';
  return <main className="portal-page">
    <div className="portal-header">
      <div><div className="eyebrow">Your private workspace</div><h1>{stageTitle}</h1><p>{stage === 'overview' ? 'Here’s what is moving forward, and what needs your attention.' : 'We’ll take this one thoughtful step at a time.'}</p></div>
      <div className="journey-progress"><div className="progress-ring"><strong>{application.completion}%</strong><span>ready</span></div><div><span>Journey progress</span><b>{application.reviewStatus === 'accepted' ? 'Accepted by your reviewer' : application.reviewStatus === 'rejected' ? 'Review decision available' : 'Keep going — you’re doing well.'}</b></div></div>
    </div>
    <div className="portal-layout">
      <aside className="journey-nav">
        <p className="nav-caption">YOUR JOURNEY</p>
        <button className={stage === 'overview' ? 'journey-nav-item selected' : 'journey-nav-item'} onClick={() => onStage('overview')}><LayoutDashboard size={18} /><span>Overview</span><ChevronRight size={15} /></button>
        {journeySteps.map(({ id, label, meta, icon: Icon }) => <button key={id} className={stage === id ? 'journey-nav-item selected' : 'journey-nav-item'} onClick={() => onStage(id)}><Icon size={18} /><span><b>{label}</b><small>{id === 'documents' ? documentsLoaded ? `${documents.length} uploaded` : 'Open to load' : meta}</small></span><ChevronRight size={15} /></button>)}
        <div className="nav-help"><CircleHelp size={18} /><div><b>Need a hand?</b><span>Talk to an expert</span></div></div>
      </aside>
      <div className="portal-content">
        {stage === 'overview' && <Overview application={application} analysis={analysis} onStage={onStage} onVideo={onVideo} />}
        {stage === 'profile' && <ProfileStage application={application} onUpdate={onUpdate} />}
        {stage === 'documents' && <DocumentsStage session={session} documents={documents} documentsLoaded={documentsLoaded} documentsLoadError={documentsLoadError} cvDraft={cvDraft} onDocumentsChanged={onDocumentsChanged} onCvGenerated={onCvGenerated} />}
        {stage === 'qualification' && <QualificationStage analysis={analysis} />}
        {stage === 'pathway' && <PathwayStage application={application} />}
      </div>
    </div>
  </main>;
}

function Overview({ application, analysis, onStage, onVideo }: { application: Application; analysis: VideoAnalysis | null; onStage: (stage: JourneyStage) => void; onVideo: () => void }) {
  return <>
    {application.reviewStatus !== 'pending' && <div className={`application-decision ${application.reviewStatus}`}>
      <BadgeCheck size={20} /><div><b>Application {application.reviewStatus} by the admin</b><p>{application.reviewNote || 'Check the decision email sent to your account.'}</p></div>
    </div>}
    <div className="overview-grid">
      <div className="welcome-card"><div className="welcome-card-copy"><span className="mini-label">YOUR NEXT MILESTONE</span><h2>{analysis ? 'Interview feedback is ready' : 'Try a short interview'}</h2><p>{analysis ? 'Review your transcript, profile comparison, and optional suggestions. They do not affect your application decision.' : 'Practice sharing your background and goals; feedback is optional and does not determine eligibility.'}</p><button className="button light" onClick={() => analysis ? onStage('qualification') : onVideo()}>{analysis ? <Mic size={16} /> : <Video size={16} />}{analysis ? 'View interview feedback' : 'Start interview'} <ArrowRight size={15} /></button></div><div className="welcome-illustration"><Mic size={34} /><span>60 sec</span></div></div>
      <div className="status-card"><div className="card-heading"><span>Profile progress</span><BadgeCheck size={19} /></div><div className="strength-score">{application.completion}<span>%</span></div><div className="score-bar"><i style={{ width: `${application.completion}%` }} /></div><p>{application.reviewStatus === 'pending' ? profileIsComplete(application) ? 'Your profile is saved. Upload the requested documents for admin review.' : 'Complete your profile before uploading documents.' : `Your application was ${application.reviewStatus}.`}</p><button className="text-link" onClick={() => onStage('profile')}>Review my profile <ChevronRight size={16} /></button></div>
    </div>
    <div className="content-heading"><div><span className="mini-label">KEEP MOVING</span><h2>Your journey at a glance</h2></div><button className="text-link" onClick={() => onStage('pathway')}>View all <ChevronRight size={16} /></button></div>
    <div className="journey-cards">{journeySteps.map(({ id, label, meta, icon: Icon }, index) => <button className="journey-card" key={id} onClick={() => onStage(id)}><span className="step-number">0{index + 1}</span><div className="journey-card-icon"><Icon size={20} /></div><h3>{label}</h3><p>{meta}</p><ChevronRight className="journey-arrow" size={17} /></button>)}</div>
    <div className="guidance-strip"><div className="guidance-icon"><Home size={21} /></div><div><span className="mini-label">WHEN YOU’RE ACCEPTED</span><h3>Your Germany starter guide will be ready.</h3><p>Accommodation, training or study route, and arrival steps — tailored to your selected city.</p></div><button className="button outline-small" onClick={() => onStage('pathway')}>View next steps</button></div>
  </>;
}

function ProfileStage({ application, onUpdate }: { application: Application; onUpdate: (application: Application) => Promise<void> }) {
  const [draft, setDraft] = useState(application);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setDraft(application), [application]);
  const update = (field: keyof Application, value: string) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [field]: value }));
  };
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const normalized = {
        ...draft,
        name: draft.name.trim(),
        goal: draft.goal.trim(),
        itExperience: draft.itExperience.trim(),
        interests: draft.interests.trim(),
        futureGoal: draft.futureGoal.trim(),
      };
      if (!profileIsComplete(normalized) || normalized.itExperience.length < 3 || normalized.interests.length < 15 || normalized.futureGoal.length < 15) {
        setError('Please complete each field with meaningful information before saving.');
        return;
      }
      await onUpdate(normalized);
      setSaved(true);
    } catch {
      setError('We could not save your profile. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="stage-panel">
    <div className="stage-heading"><div><span className="mini-label">STEP 01 / 04</span><h2>Let’s get to know you</h2><p>Share your background and goals. An authorised admin makes the application decision.</p></div><span className="saved-state">{saved ? <><Check size={14} /> Saved just now</> : 'Required before document review'}</span></div>
    <form className="profile-form" onSubmit={saveProfile}>
      <div className="form-grid">
        <label>Full name<input required minLength={2} maxLength={100} value={draft.name} onChange={(event: ChangeEvent<HTMLInputElement>) => update('name', event.target.value)} /></label>
        <label>What are you applying for?<select required value={draft.goal} onChange={(event: ChangeEvent<HTMLSelectElement>) => update('goal', event.target.value)}><option>IT / Software Ausbildung</option><option>University study in Germany</option><option>Skilled employment in Germany</option></select></label>
        <label>Highest education completed<select required value={draft.education} onChange={(event: ChangeEvent<HTMLSelectElement>) => update('education', event.target.value)}><option value="">Choose your education</option><option>Secondary school</option><option>Vocational qualification</option><option>Some college or university</option><option>Bachelor’s degree</option><option>Other / still studying</option></select></label>
        <label>Current German level<select required value={draft.germanLevel} onChange={(event: ChangeEvent<HTMLSelectElement>) => update('germanLevel', event.target.value)}><option value="">Choose your level</option><option>No German yet</option><option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1 or above</option><option>Not sure</option></select></label>
        <label>IT or other relevant experience <span className="field-hint">(write “none yet” if you’re new)</span><textarea required minLength={3} maxLength={1000} value={draft.itExperience} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => update('itExperience', event.target.value)} placeholder="Courses, projects, work, or no experience yet" /></label>
        <label>What interests you about your chosen area? <span className="field-hint">(at least a short sentence)</span><textarea required minLength={15} maxLength={1000} value={draft.interests} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => update('interests', event.target.value)} placeholder="What would you enjoy learning or doing?" /></label>
        <label className="field-wide">What would you like your future to look like? <textarea required minLength={15} maxLength={1000} value={draft.futureGoal} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => update('futureGoal', event.target.value)} placeholder="Describe your longer-term goal" /></label>
        <label>Preferred city<select value={draft.city} onChange={(event: ChangeEvent<HTMLSelectElement>) => update('city', event.target.value)}><option>Berlin</option><option>Hamburg</option><option>Munich</option><option>Cologne</option></select></label>
      </div>
      {error && <div className="inline-error">{error}</div>}<button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving profile…' : saved ? 'Profile saved' : 'Save profile'} <Check size={16} /></button>
    </form>
    <div className="agent-note"><Sparkles size={18} /><p><b>Human review</b><br />AI may help check document readability and prepare optional coaching, but it does not rank candidates or make an admission or employment decision.</p></div>
  </div>;
}

function DocumentsStage({ session, documents, documentsLoaded, documentsLoadError, cvDraft, onDocumentsChanged, onCvGenerated }: { session: Session | null; documents: ApplicantDocument[]; documentsLoaded: boolean; documentsLoadError: string; cvDraft: CvDraft | null; onDocumentsChanged: () => Promise<void>; onCvGenerated: (draft: CvDraft) => void }) {
  const [aiConsent, setAiConsent] = useState(false);
  const [busyDocument, setBusyDocument] = useState('');
  const [generatingCv, setGeneratingCv] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const types: ApplicantDocument['document_type'][] = ['english_test', 'ielts', 'degree', 'other'];
  const requiredTypes: ApplicantDocument['document_type'][] = ['english_test', 'ielts', 'degree'];
  const allDocumentsAnalyzed = requiredTypes.every((type) => documents.some((document) => document.document_type === type && document.ai_analysis !== null))
    && documents.every((document) => document.ai_analysis !== null);
  const uploadDocument = async (type: ApplicantDocument['document_type'], event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!session || !isSupabaseConfigured) {
      setError('Secure document upload requires a configured Supabase account.');
      return;
    }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setError('Upload a non-empty PDF, JPG, or PNG no larger than 10 MB.');
      return;
    }
    setBusyDocument(type);
    setError('');
    setNotice('');
    const id = crypto.randomUUID();
    const path = `${session.user.id}/${id}`;
    const { error: uploadError } = await supabase.storage.from('private-applicant-documents')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      console.error('document upload failed', uploadError);
      setError('The document could not be uploaded securely. Please try again.');
      setBusyDocument('');
      return;
    }
    const { error: insertError } = await supabase.from('applicant_documents').insert({
      id,
      user_id: session.user.id,
      document_type: type,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
    });
    if (insertError) {
      console.error('document record save failed', insertError);
      const { error: cleanupError } = await supabase.storage.from('private-applicant-documents').remove([path]);
      if (cleanupError) console.error('orphaned document cleanup failed', cleanupError);
      setError('The upload completed, but its secure record could not be saved. Please retry.');
      setBusyDocument('');
      return;
    }
    try {
      await onDocumentsChanged();
      setNotice(`${file.name} uploaded. It is awaiting human verification.`);
    } catch {
      setError('The document was uploaded, but the list could not be refreshed. Reload the page.');
    } finally {
      setBusyDocument('');
    }
  };
  const analyzeDocument = async (document: ApplicantDocument) => {
    if (!aiConsent) {
      setError('Please agree to have document contents processed by OpenAI before requesting an AI check.');
      return;
    }
    setBusyDocument(document.id);
    setError('');
    setNotice('');
    const { data, error: invokeError } = await supabase.functions.invoke('analyze-document', {
      body: { documentId: document.id, aiConsent: true },
    });
    if (invokeError || !data?.analysis || typeof data.analysis.summary !== 'string') {
      console.error('document analysis failed', invokeError);
      setError(invokeError?.message ?? 'The document analysis did not return a valid result.');
      setBusyDocument('');
      return;
    }
    try {
      await onDocumentsChanged();
      setNotice('AI content check complete. This is not an authenticity check or admin verification.');
    } catch {
      setError('The analysis completed, but the document list could not be refreshed.');
    } finally {
      setBusyDocument('');
    }
  };
  const generateCv = async () => {
    if (!aiConsent) {
      setError('Please consent to AI processing of your uploaded documents before generating a CV.');
      return;
    }
    setGeneratingCv(true);
    setError('');
    setNotice('');
    const { data, error: invokeError } = await supabase.functions.invoke('generate-cv', { body: { aiConsent: true } });
    if (invokeError || !data?.cv || typeof data.cv.cvText !== 'string' || !isStringArray(data.cv.improvementTips)) {
      console.error('CV generation failed', invokeError);
      setError(invokeError?.message ?? 'Your CV could not be generated.');
      setGeneratingCv(false);
      return;
    }
    const draft: CvDraft = {
      cvText: data.cv.cvText,
      improvementTips: data.cv.improvementTips,
      generatedAt: typeof data.cv.generatedAt === 'string' ? data.cv.generatedAt : new Date().toISOString(),
    };
    onCvGenerated(draft);
    setNotice('CV draft created. Please review and correct it before using it.');
    setGeneratingCv(false);
  };
  const downloadCv = () => {
    if (!cvDraft) return;
    const url = URL.createObjectURL(new Blob([cvDraft.cvText], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'educaro-cv-draft.txt';
    link.click();
    URL.revokeObjectURL(url);
  };
  const typeLabels: Record<ApplicantDocument['document_type'], string> = {
    english_test: 'English test document',
    ielts: 'IELTS certificate',
    degree: 'Degree certificate',
    other: 'Other required document',
  };
  return <div className="stage-panel">
    <div className="stage-heading"><div><span className="mini-label">STEP 02 / 04</span><h2>Upload your documents</h2><p>Upload English test results, IELTS, your degree certificate, and any other required documents.</p></div><span className="review-pill"><span /> {documents.length} uploaded</span></div>
    {!isSupabaseConfigured && <div className="inline-error">Document storage is unavailable until Supabase is configured. No documents will be shown as verified.</div>}
    {!documentsLoaded && <p role="status">Loading your documents…</p>}
    {documentsLoadError && <div className="inline-error">{documentsLoadError}<button className="text-link" onClick={() => void onDocumentsChanged().catch((loadError) => { console.error('applicant documents retry failed', loadError); })}>Try again</button></div>}
    <div className="document-requirements">{requiredTypes.map((type) => <span key={type}>{documents.some((document) => document.document_type === type) ? <Check size={14} /> : <CircleHelp size={14} />}{typeLabels[type]}{documents.some((document) => document.document_type === type) ? ' · uploaded' : ' · needed'}</span>)}</div>
    <label className="consent-check document-consent"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} /> I consent to OpenAI processing document contents to check readability/type and extract facts for an editable CV. AI cannot confirm authenticity or replace reviewer verification.</label>
    {types.map((type) => <section className="document-upload-group" key={type}>
      <div><b>{typeLabels[type]}</b><span>PDF, JPG, or PNG · up to 10 MB</span></div>
      <label className="button secondary upload-button">{busyDocument === type ? 'Uploading…' : 'Choose file'}<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={!isSupabaseConfigured || busyDocument !== ''} onChange={(event) => void uploadDocument(type, event)} /></label>
      {documents.filter((document) => document.document_type === type).map((document) => <article className="uploaded-document" key={document.id}>
        <div className="uploaded-document-heading"><FileCheck2 size={18} /><div><b>{document.file_name}</b><span>{(document.file_size / (1024 * 1024)).toFixed(2)} MB · Awaiting reviewer verification</span></div>
          <button className="text-link" disabled={busyDocument !== ''} onClick={() => void analyzeDocument(document)}>{busyDocument === document.id ? 'Checking…' : document.ai_analysis ? 'Recheck with AI' : 'AI content check'}</button>
        </div>
        {document.ai_analysis && <div className="document-ai-result"><b>AI content check only — a human must verify this document</b><p>Document type appears {document.ai_analysis.documentTypeMatch ? 'consistent' : 'inconsistent'} with the selected category; text is {document.ai_analysis.readable ? 'readable' : 'not clearly readable'}.</p><p>{document.ai_analysis.summary}</p>{document.ai_analysis.extractedFacts.length > 0 && <p>Extracted: {document.ai_analysis.extractedFacts.join(' · ')}</p>}{document.ai_analysis.issues.length > 0 && <p>Check: {document.ai_analysis.issues.join(' · ')}</p>}</div>}
      </article>)}
    </section>)}
    {error && <div className="inline-error">{error}</div>}{notice && <p className="success-message">{notice}</p>}
    <div className="cv-panel"><div><span className="mini-label">YOUR CV DRAFT</span><p>{allDocumentsAnalyzed ? 'Create an editable CV using your profile and AI-extracted document facts.' : 'Upload and run the optional AI content check on your documents to prepare a CV draft.'}</p></div><button className="button primary" disabled={!isSupabaseConfigured || !allDocumentsAnalyzed || generatingCv} onClick={() => void generateCv()}>{generatingCv ? 'Creating CV…' : cvDraft ? 'Regenerate CV' : 'Create CV draft'} <ArrowRight size={16} /></button>
      {cvDraft && <div className="cv-draft"><pre>{cvDraft.cvText}</pre><button className="button secondary" onClick={downloadCv}>Download editable text</button><details><summary>Optional improvement suggestions</summary><ul>{cvDraft.improvementTips.map((tip, index) => <li key={`${index}-${tip}`}>{tip}</li>)}</ul></details></div>}
    </div>
    <div className="upload-note"><ShieldCheck size={18} /><span>Uploads are private. The AI check does not verify authenticity; only an authorised reviewer can make the application decision.</span></div>
  </div>;
}
function QualificationStage({ analysis }: { analysis: VideoAnalysis | null }) {
  if (!analysis) return <div className="stage-panel result-panel"><div className="result-orb"><BadgeCheck size={31} /></div><span className="mini-label">STEP 03 / 04 · OPTIONAL INTERVIEW PRACTICE</span><h2>No interview feedback yet</h2><p>Record a short interview to get a transcript, communication tips, and a comparison between what you say and the details in your saved profile. It does not score your eligibility or affect the reviewer’s decision.</p></div>;
  const comparisonLabels: Record<ProfileComparison['field'], string> = {
    education: 'Education',
    germanLevel: 'German level',
    itExperience: 'IT experience',
    interests: 'Interests',
    futureGoal: 'Future goal',
  };
  const comparisonStatuses: Record<ProfileComparison['status'], string> = {
    consistent: 'Consistent with profile',
    possible_mismatch: 'Possible difference to review',
    not_mentioned: 'Not mentioned in interview',
    unclear: 'Unclear from the transcript',
  };
  return <div className="stage-panel result-panel"><div className="result-orb"><Mic size={31} /></div><span className="mini-label">OPTIONAL INTERVIEW FEEDBACK</span><h2>Your transcript and feedback</h2><p>{analysis.summary}</p><div className="analysis-extract"><span className="mini-label">SPEECH-TO-TEXT TRANSCRIPT</span><p>{analysis.transcript}</p></div>{analysis.profileComparisons && <section className="profile-comparison"><h3>Interview vs. your profile</h3><p>These are AI-detected text comparisons only. A possible difference is a prompt to check your own entries, not proof that either statement is wrong.</p>{analysis.profileComparisons.map((item) => <article className={`profile-comparison-item ${item.status}`} key={item.field}><div><b>{comparisonLabels[item.field]}</b><span>{comparisonStatuses[item.status]}</span></div><p><strong>Your profile:</strong> {item.profileValue || 'No value saved'}</p><p><strong>Heard in the interview:</strong> {item.spokenEvidence || 'No related statement detected'}</p><small>{item.explanation}</small></article>)}</section>}<div className="qualification-grid"><div><span>Points you covered</span>{analysis.highlights.length ? analysis.highlights.map((item, index) => <b key={`${index}-${item}`}>{item}</b>) : <b>No highlights returned</b>}</div><div><span>Optional improvements</span>{analysis.speakingTips.length ? analysis.speakingTips.map((item, index) => <b key={`${index}-${item}`}>{item}</b>) : <b>No suggestions returned</b>}</div></div><p className="review-disclaimer">Feedback compares only the words transcribed with the profile details you entered. Transcription and AI comparisons can be mistaken; they cannot verify facts or judge honesty. Communication suggestions are optional and may be ignored. No appearance, expression, accent, emotion, or eligibility assessment is made.</p></div>;
}
function PathwayStage({ application }: { application: Application }) {
  const accepted = application.reviewStatus === 'accepted';
  const destination = application.city || 'your selected city';
  const route = application.goal || 'your selected route';
  return <div className="stage-panel pathway-panel"><div className="stage-heading"><div><span className="mini-label">STEP 04 / 04 · YOUR GERMANY GUIDE</span><h2>{accepted ? `Next steps for ${destination}` : 'Your next steps, when ready'}</h2><p>{accepted ? `Your reviewer accepted your application for ${route}. Use this checklist to plan; confirm details with your institution or employer.` : 'Your city- and route-specific guide unlocks after an admin accepts your application.'}</p></div><span className="coming-pill">{accepted ? 'Accepted' : 'Awaiting admin decision'}</span></div><div className="pathway-cards"><div><Building2 size={21} /><span>{application.goal.toLowerCase().includes('study') ? 'Institutes and courses' : 'Training or work places'}</span><p>Ask your selected institute, employer, or training provider for confirmed vacancies, dates, and entry requirements in {destination}.</p></div><div><Home size={21} /><span>Accommodation</span><p>Compare verified housing options near your confirmed destination and check current costs before booking.</p></div><div><BookOpen size={21} /><span>What to prepare</span><p>Use your provider’s official checklist for documents, travel, banking, and arrival arrangements.</p></div></div><div className="locked-message"><LockKeyhole size={18} /> This is planning guidance, not a live directory or a visa/legal decision. Verify providers and requirements directly.</div></div>;
}

function VideoView({ session, application, onBack, onProfile, onSaveVideo, onAnalysis, onComplete }: { session: Session | null; application: Application; onBack: () => void; onProfile: () => void; onSaveVideo: (path: string) => Promise<void>; onAnalysis: (analysis: VideoAnalysis) => Promise<void>; onComplete: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const [videoPath, setVideoPath] = useState('');
  const [recording, setRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [error, setError] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const startRecording = async () => {
    if (!isSupabaseConfigured) {
      setError('Secure video storage and AI review require a configured Supabase project. You can still save your profile.');
      return;
    }
    if (!profileIsComplete(application)) {
      setError('Complete and save your applicant profile before recording.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        setHasRecording(true);
        if (!session || chunksRef.current.length === 0) return;
        const file = new File(chunksRef.current, 'introduction.webm', { type: 'video/webm' });
        if (file.size > 25 * 1024 * 1024) {
          setError('This video is over the 25 MB analysis limit. Please record a shorter introduction and try again.');
          return;
        }
        setUploading(true);
        const path = `${session.user.id}/${crypto.randomUUID()}.webm`;
        try {
          const { error: uploadError } = await supabase.storage.from('private-applicant-media').upload(path, file, { contentType: 'video/webm', upsert: false });
          if (uploadError) throw uploadError;
          await onSaveVideo(path);
          setVideoPath(path);
        } catch (uploadError) {
          console.error('video upload or record save failed', uploadError);
          setError('The recording is ready, but it could not be saved securely. Please try again.');
        } finally {
          setUploading(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      recordingTimeoutRef.current = window.setTimeout(() => stopRecording(), 60_000);
      setError('');
      setAnalysisError('');
      setVideoPath('');
    } catch (cameraError) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      console.error('camera access failed', cameraError);
      setError('Camera and microphone access is needed for the introduction. Allow access in your browser settings and try again.');
    }
  };
  const stopRecording = () => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setRecording(false);
  };
  const analyzeRecording = async () => {
    if (!session || !videoPath) {
      setAnalysisError('Save your recording first, then try the analysis again.');
      return;
    }
    if (!profileIsComplete(application)) {
      setAnalysisError('Complete and save every required profile field before recording your introduction.');
      return;
    }
    if (!aiConsent) {
      setAnalysisError('Please consent to OpenAI transcription and optional speaking feedback before continuing.');
      return;
    }
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('analyze-introduction', { body: { videoPath } });
      if (invokeError) {
        console.error('video analysis failed', invokeError);
        setAnalysisError('We could not analyze the video. Check that the analysis service is configured, then try again.');
        return;
      }
      if (!isVideoAnalysis(data?.analysis)) {
        console.error('video analysis returned an invalid response');
        setAnalysisError('The analysis service returned an incomplete result. Please try again.');
        return;
      }
      await onAnalysis(data.analysis);
      onComplete();
    } catch (analysisRequestError) {
      console.error('video analysis request failed', analysisRequestError);
      setAnalysisError('We could not complete and save the review. Check your connection and try again.');
    } finally {
      setAnalyzing(false);
    }
  };
  useEffect(() => () => {
    if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  return <main className="video-page">
    <button className="back-link" onClick={onBack}><ChevronRight size={16} className="rotate-180" /> Back to my journey</button>
    <div className="video-layout">
      <div className="video-copy">
        <div className="eyebrow"><Video size={15} /> Your introduction</div>
        <h1>Let your story<br /><em>come through.</em></h1>
        <p>Answer these short interview prompts in your own words. The AI will transcribe your answers and compare related statements with the profile you saved.</p>
        <div className="video-tips"><span><Check size={15} /> Briefly introduce your education and background</span><span><Check size={15} /> Describe your IT experience and interests</span><span><Check size={15} /> Share your German level and future goal</span><span><Check size={15} /> Keep it natural — up to 60 seconds</span></div>
        <div className="video-privacy"><LockKeyhole size={15} /><span>Your recording is stored privately. With your consent, its audio is transcribed and compared with your saved profile. AI can flag possible differences, but cannot determine which information is correct.</span></div>
      </div>
      <div className="recorder-card">
        <div className="camera-frame">
          <video ref={videoRef} muted playsInline className={recording ? 'visible' : ''} />
          <div className={recording ? 'camera-placeholder hidden' : 'camera-placeholder'}><div className="camera-orb"><Video size={28} /></div><span>Camera preview</span><small>Nothing is recorded until you press start.</small></div>
          {recording && <div className="recording-badge"><span /> Recording</div>}
        </div>
        {!profileIsComplete(application) && !recording && <div className="profile-required"><p>Complete your education, German level, IT experience, interests, and future goal before recording.</p><button className="button secondary full" onClick={onProfile}>Complete applicant profile <ArrowRight size={16} /></button></div>}
        {error && <div className="inline-error">{error}</div>}
        {analysisError && <div className="inline-error">{analysisError}</div>}
        {profileIsComplete(application) && !hasRecording && !recording && <button className="button primary full" onClick={startRecording}><Video size={17} /> Start recording</button>}
        {recording && <button className="button stop full" onClick={stopRecording}><span /> Stop recording</button>}
        {hasRecording && !recording && <div className="recording-complete">
          <div>{uploading ? 'Saving securely…' : videoPath ? <><Check size={16} /> Recording saved securely</> : 'Recording ready — save it to continue'}</div>
          <label className="consent-check"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} /> I agree to send the audio to OpenAI for transcription and comparison with the profile details I entered. The AI may be wrong and does not assess appearance or eligibility.</label>
          <button className="button primary" onClick={analyzeRecording} disabled={uploading || analyzing || !videoPath}>{uploading ? 'Saving…' : analyzing ? 'Transcribing and comparing…' : 'Get interview feedback'} <ArrowRight size={16} /></button>
          <button className="retry-link" onClick={() => { setHasRecording(false); setVideoPath(''); setAnalysisError(''); }}>Record again</button>
        </div>}
        <p className="recorder-caption"><ShieldCheck size={14} /> Short interview: transcript, communication suggestions, and profile consistency prompts. It does not affect the admin decision.</p>
      </div>
    </div>
  </main>;
}

function ApplicantAuth({ onClose, onSuccess, initialMode, initialError }: {
  onClose: () => void;
  onSuccess: (role: 'admin' | 'applicant', userId?: string) => void;
  initialMode: 'signin' | 'signup' | 'admin';
  initialError: string;
}) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'admin'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [adminUserId, setAdminUserId] = useState('');
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const close = () => {
    if (mode === 'admin' && adminUserId) void supabase.auth.signOut();
    onClose();
  };

  const requestAdminCode = async (initialRequest: boolean) => {
    setBusy(true);
    setError('');
    const { data, error: otpError } = await supabase.functions.invoke('request-admin-otp', { body: {} });
    setBusy(false);
    if (otpError || data?.codeSent !== true) {
      console.error('admin OTP request failed', otpError);
      if (initialRequest) {
        await supabase.auth.signOut();
        setAdminUserId('');
      }
      setError(otpError?.status === 404
        ? 'Admin sign-in is unavailable because the Supabase OTP functions have not been deployed. Deploy request-admin-otp and verify-admin-otp, then try again.'
        : data?.error ?? (otpError?.status === 403
        ? 'This verified email is not configured for admin access.'
        : otpError?.status === 429
          ? 'Wait one minute before requesting another admin code.'
          : otpError?.message ?? 'Admin email verification could not be started.'));
      return;
    }
    setCodeSent(true);
    setCode('');
    setNotice('A one-time verification code was sent to the configured admin inbox.');
  };

  const sendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !password || (mode === 'signup' && !name.trim())) {
      setError(mode === 'signup' ? 'Enter your name, a valid email address, and a password.' : 'Enter a valid email address and password.');
      return;
    }
    if (!isSupabaseConfigured) {
      if (mode === 'admin') {
        setError('Secure admin access is unavailable until Supabase and backend admin settings are configured.');
        return;
      }
      setBusy(true);
      setError('');
      const result = mode === 'signup'
        ? await signUpLocalAccount({ email: normalizedEmail, password, name: name.trim() })
        : await signInLocalAccount({ email: normalizedEmail, password });
      setBusy(false);
      if (result.error) {
        setError(result.error.message);
        if (mode === 'signup' && /already|exists/i.test(result.error.message)) setMode('signin');
        return;
      }
      onSuccess('applicant');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    if (mode === 'admin') {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (signInError || !signInData.user || !signInData.session) {
        setBusy(false);
        setError('The reviewer email or password is incorrect.');
        return;
      }
      setAdminUserId(signInData.user.id);
      await requestAdminCode(true);
      return;
    }

    const result = mode === 'signup'
      ? await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { display_name: name.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (result.error) {
      setBusy(false);
      setError(result.error.message || 'Your account could not be verified. Please try again.');
      if (mode === 'signup' && /already|registered|exists/i.test(result.error.message)) setMode('signin');
      return;
    }
    if (mode === 'signup' && !result.data.session) {
      setBusy(false);
      setMode('signin');
      setNotice('Check your email to confirm your account, then sign in with your email and password.');
      return;
    }
    if (!result.data.user || !result.data.session) {
      setBusy(false);
      setError('Your account session could not be verified. Please try again.');
      return;
    }

    const { data: roleData, error: roleError } = await supabase.functions.invoke('resolve-account-role', { body: {} });
    if (roleError || (roleData?.role !== 'admin' && roleData?.role !== 'applicant')) {
      console.error('account role resolution failed', roleError);
      await supabase.auth.signOut();
      setBusy(false);
      if (roleData?.adminOtpRequired === true) {
        setMode('admin');
        setError('This configured admin account must complete the separate email-code verification.');
      } else if (roleError?.status === 404) {
        setError('Sign-in is unavailable because the Supabase account-role function has not been deployed. Deploy resolve-account-role, then try again.');
      } else {
        setError(roleData?.error ?? roleError?.message ?? 'Your account access could not be resolved.');
      }
      return;
    }
    setBusy(false);
    onSuccess(roleData.role, result.data.user.id);
  };

  const verifyAdminCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the six-digit code sent to the configured admin inbox.');
      return;
    }
    setBusy(true);
    setError('');
    const { data, error: verifyError } = await supabase.functions.invoke('verify-admin-otp', { body: { code } });
    setBusy(false);
    if (verifyError || data?.role !== 'admin' || !adminUserId) {
      console.error('admin email OTP verification failed', verifyError);
      setError(data?.error ?? verifyError?.message ?? 'The admin verification code is invalid or expired.');
      return;
    }
    onSuccess('admin', adminUserId);
  };

  const switchMode = (nextMode: 'signin' | 'signup' | 'admin') => {
    if (mode === 'admin' && adminUserId && nextMode !== 'admin') void supabase.auth.signOut();
    setMode(nextMode);
    setAdminUserId('');
    setCode('');
    setCodeSent(false);
    setError('');
    setNotice('');
    setShowPassword(false);
  };

  const isAdminMode = mode === 'admin';
  return <div className="modal-backdrop" onClick={() => { if (!busy) close(); }}><div className="login-modal" onClick={(event) => event.stopPropagation()}><button className="close-button" onClick={close} disabled={busy}><X size={18} /></button><div className="modal-icon">{isAdminMode ? <LockKeyhole size={21} /> : <Sparkles size={21} />}</div><span className="mini-label">{isAdminMode ? 'PRIVATE REVIEWER ACCESS' : 'YOUR PRIVATE JOURNEY'}</span><h2>{isAdminMode ? 'Admin workspace' : mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2><p>{isAdminMode ? 'Sign in with the fixed reviewer account, then verify the one-time code sent to its configured email.' : isSupabaseConfigured ? 'Create an account or sign in securely with your email and password.' : 'Preview mode only: accounts are stored in this browser and are not secure. Do not enter real personal information.'}</p>{mode === 'signup' && <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" disabled={codeSent} /></label>}<label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" disabled={codeSent} /></label><label>{isSupabaseConfigured ? 'Password' : 'Preview password'}<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSupabaseConfigured ? 'Enter your password' : 'Preview-only password'} style={{ flex: 1 }} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} disabled={codeSent} /><button type="button" className="switch-auth" onClick={() => setShowPassword((value) => !value)} style={{ margin: 0, padding: 0, minWidth: 'auto', fontSize: 12, whiteSpace: 'nowrap' }}>{showPassword ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}</button></div></label>{isAdminMode && codeSent && <label>Email verification code<input type="text" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} /></label>}{error && <div className="inline-error">{error}</div>}{notice && <p className="success-message">{notice}</p>}{codeSent ? <><button className="button primary full" onClick={() => void verifyAdminCode()} disabled={busy}>{busy ? 'Verifying…' : 'Verify code and sign in'} <ArrowRight size={16} /></button><button className="switch-auth" onClick={() => void requestAdminCode(false)} disabled={busy}>Send a new code</button></> : <button className="button primary full" onClick={() => void sendCode()} disabled={busy}>{busy ? 'Please wait…' : isAdminMode ? 'Verify reviewer password' : !isSupabaseConfigured ? (mode === 'signup' ? 'Create preview account' : 'Sign in to preview') : (mode === 'signup' ? 'Create account' : 'Sign in with password')} <ArrowRight size={16} /></button>}{isAdminMode ? <button className="switch-auth" onClick={() => switchMode('signin')} disabled={busy}>Sign in as a regular user</button> : <><button className="switch-auth" onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')} disabled={busy}>{mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button><button className="switch-auth" onClick={() => switchMode('admin')} disabled={busy}>Admin? Use reviewer sign-in</button></>}<div className="modal-security"><ShieldCheck size={15} /> {isAdminMode ? 'Admin accounts must be allowlisted and pass both password and email-code checks.' : isSupabaseConfigured ? 'Your data is secured by Supabase account access.' : 'Production authentication is not configured.'}</div></div></div>;
}
type AdminReviewApiApplication = {
  id: string;
  user_id: string;
  name: string;
  goal: string;
  city: string;
  completion: number;
  status: string;
  review_status: string | null;
  review_note: string | null;
  updated_at: string;
  profile_data: Record<string, unknown> | null;
};

function AdminView({ onSignOut, applications }: { onSignOut: () => void; applications: AdminApplication[] }) {
  const needsReview = applications.filter((item) => item.reviewStatus === 'pending').length;
  return <main className="admin-page"><div className="admin-header"><div><div className="eyebrow"><LockKeyhole size={15} /> Secure review workspace</div><h1>Good morning, reviewer.</h1><p>Keep every applicant moving with care and clarity.</p></div><button className="button secondary" onClick={onSignOut}>Sign out</button></div><div className="admin-stats"><div><span>Active applicants</span><b>{applications.length}</b><small>Stored securely</small></div><div><span>Need your review</span><b>{needsReview}</b><small className="warm">Pending admin decisions</small></div><div><span>Avg. completion</span><b>{applications.length ? Math.round(applications.reduce((sum, item) => sum + item.completion, 0) / applications.length) : 0}%</b><small>Across applications</small></div><div><span>Pathways unlocked</span><b>{applications.filter((item) => item.reviewStatus === 'accepted').length}</b><small>Accepted by a reviewer</small></div></div><div className="admin-foot-note"><ShieldCheck size={17} /><span>Applicant data is visible only to authorised Educaro reviewers. All access is recorded for safety.</span></div></main>;
}

function AdminWorkspace({ onSignOut }: { onSignOut: () => void }) {
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  return <div className="admin-workspace"><AdminView onSignOut={onSignOut} applications={applications} /><AdminReviewQueue onApplicationsLoaded={setApplications} /></div>;
}

function AdminReviewQueue({ onApplicationsLoaded }: { onApplicationsLoaded: (applications: AdminApplication[]) => void }) {
  const [applications, setApplications] = useState<AdminReviewRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: requestError } = await supabase.functions.invoke<{
      applications: AdminReviewApiApplication[];
      documents: ApplicantDocument[];
    }>('admin-review', { body: { action: 'list' } });
    if (requestError || !data?.applications || !data.documents) {
      console.error('admin review queue load failed', requestError);
      setError('Applicant details could not be loaded. Confirm the admin account and database migration, then reload.');
      setLoading(false);
      return;
    }
    const documentsByUser = new Map<string, ApplicantDocument[]>();
    for (const item of data.documents) {
      const userDocuments = documentsByUser.get(item.user_id) ?? [];
      userDocuments.push({
        ...item,
        ai_analysis: item.ai_analysis && typeof item.ai_analysis === 'object' ? item.ai_analysis as DocumentAnalysis : null,
      });
      documentsByUser.set(item.user_id, userDocuments);
    }
    const records: AdminReviewRecord[] = data.applications.map((item): AdminReviewRecord => ({
      id: item.id,
      userId: item.user_id,
      name: item.name,
      goal: item.goal,
      city: item.city,
      completion: item.completion,
      status: item.status,
      reviewStatus: item.review_status === 'accepted' || item.review_status === 'rejected' ? item.review_status : 'pending',
      reviewNote: item.review_note ?? '',
      lastUpdated: item.updated_at,
      profileData: item.profile_data && typeof item.profile_data === 'object' ? item.profile_data : {},
      documents: documentsByUser.get(item.user_id) ?? [],
    }));
    const requiredTypes: ApplicantDocument['document_type'][] = ['english_test', 'ielts', 'degree'];
    records.sort((left, right) => {
      const leftCoverage = requiredTypes.filter((type) => left.documents.some((document) => document.document_type === type)).length;
      const rightCoverage = requiredTypes.filter((type) => right.documents.some((document) => document.document_type === type)).length;
      if (leftCoverage !== rightCoverage) return rightCoverage - leftCoverage;
      if (profileIsComplete(adminProfile(left))) return profileIsComplete(adminProfile(right)) ? 0 : -1;
      if (profileIsComplete(adminProfile(right))) return 1;
      return right.documents.length - left.documents.length || right.lastUpdated.localeCompare(left.lastUpdated);
    });
    setApplications(records);
    onApplicationsLoaded(records);
    setLoading(false);
  }, [onApplicationsLoaded]);
  useEffect(() => { void loadApplications(); }, [loadApplications]);
  return <section className="admin-review-queue">
    <div className="admin-queue-heading"><div><span className="mini-label">HUMAN REVIEW</span><h2>Documents and decisions</h2><p>Sorted by required-document coverage and profile completeness only. No AI eligibility ranking is used.</p></div><button className="button secondary" onClick={() => void loadApplications()} disabled={loading}>Refresh list</button></div>
    {error && <div className="inline-error">{error}</div>}
    {loading ? <p>Loading applicant records…</p> : applications.length === 0 ? <p>No application records are available.</p> : applications.map((item) => <AdminReviewCard key={item.id} application={item} onDecision={loadApplications} />)}
  </section>;
}
function adminProfile(application: AdminReviewRecord): Application {
  const profile = application.profileData;
  return {
    ...applicationSeed,
    name: application.name,
    goal: application.goal,
    city: application.city,
    education: typeof profile.education === 'string' ? profile.education : '',
    germanLevel: typeof profile.germanLevel === 'string' ? profile.germanLevel : '',
    itExperience: typeof profile.itExperience === 'string' ? profile.itExperience : '',
    interests: typeof profile.interests === 'string' ? profile.interests : '',
    futureGoal: typeof profile.futureGoal === 'string' ? profile.futureGoal : '',
    completion: application.completion,
    status: application.status,
    reviewStatus: application.reviewStatus,
    reviewNote: application.reviewNote,
    lastUpdated: application.lastUpdated,
  };
}

function AdminReviewCard({ application, onDecision }: { application: AdminReviewRecord; onDecision: () => Promise<void> }) {
  const [note, setNote] = useState(application.reviewNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requiredTypes: ApplicantDocument['document_type'][] = ['english_test', 'ielts', 'degree'];
  const completeProfile = profileIsComplete(adminProfile(application));
  const cvData = application.profileData.cvDraft && typeof application.profileData.cvDraft === 'object' && !Array.isArray(application.profileData.cvDraft)
    ? application.profileData.cvDraft as Record<string, unknown>
    : null;
  const labelForType = (type: ApplicantDocument['document_type']) => ({
    english_test: 'English test',
    ielts: 'IELTS certificate',
    degree: 'Degree certificate',
    other: 'Other document',
  })[type];
  const openDocument = async (document: ApplicantDocument) => {
    const { data, error: signedUrlError } = await supabase.functions.invoke<{ signedUrl: string }>('admin-review', {
      body: { action: 'document-link', storagePath: document.storage_path },
    });
    if (signedUrlError || !data?.signedUrl) {
      console.error('admin document link creation failed', signedUrlError);
      setError('A secure document link could not be created.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };
  const submitDecision = async (decision: 'accepted' | 'rejected') => {
    if (note.trim().length < 5) {
      setError('Add a clear message of at least five characters for the applicant.');
      return;
    }
    setBusy(true);
    setError('');
    const { data, error: decisionError } = await supabase.functions.invoke('review-application', {
      body: { applicationId: application.id, decision, note: note.trim() },
    });
    if (decisionError || data?.emailSent !== true) {
      console.error('admin decision or notification failed', decisionError);
      setError(data?.message ?? decisionError?.message ?? data?.error ?? 'The decision email was not confirmed. Refresh to check the saved decision and retry.');
      setBusy(false);
      await onDecision();
      return;
    }
    setBusy(false);
    await onDecision();
  };
  const documentsCovered = requiredTypes.filter((type) => application.documents.some((document) => document.document_type === type)).length;
  return <article className="admin-review-card">
    <div className="admin-review-card-header"><div><h3>{application.name || 'Unnamed applicant'}</h3><span>{application.goal} · {application.city}</span></div><div className={`review-status ${application.reviewStatus}`}>{application.reviewStatus === 'pending' ? 'Pending admin decision' : application.reviewStatus}</div></div>
    <div className="review-objective-summary"><span>Profile {completeProfile ? 'complete' : 'incomplete'}</span><span>Required document types {documentsCovered}/3</span><span>{application.documents.length} documents uploaded</span><span>{application.status}</span></div>
    <details className="admin-applicant-details"><summary>Review profile and documents</summary>
      <dl className="admin-profile-facts"><dt>Education</dt><dd>{String(application.profileData.education || 'Not provided')}</dd><dt>German level</dt><dd>{String(application.profileData.germanLevel || 'Not provided')}</dd><dt>IT experience</dt><dd>{String(application.profileData.itExperience || 'Not provided')}</dd><dt>Interests</dt><dd>{String(application.profileData.interests || 'Not provided')}</dd><dt>Future goal</dt><dd>{String(application.profileData.futureGoal || 'Not provided')}</dd></dl>
      <div className="admin-document-list">{application.documents.length ? application.documents.map((document) => <div className="admin-document-item" key={document.id}>
        <div><b>{labelForType(document.document_type)} · {document.file_name}</b><span>{document.ai_analysis ? `AI: ${document.ai_analysis.summary}` : 'No AI content check yet'} · Not verified until reviewed by a person</span>{document.ai_analysis?.issues.map((issue, index) => <small key={`${index}-${issue}`}>AI noted: {issue}</small>)}</div>
        <button className="button secondary" onClick={() => void openDocument(document)}>Open securely</button>
      </div>) : <p>No documents uploaded. No document is marked as verified.</p>}</div>
      {cvData && typeof cvData.cvText === 'string' && <details><summary>Applicant CV draft</summary><pre>{cvData.cvText}</pre></details>}
      <label className="review-note-field">Decision message (emailed to the applicant)<textarea value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder="Explain the decision and provide next steps." /></label>
      {error && <div className="inline-error">{error}</div>}
      <div className="admin-decision-actions"><button className="button primary" disabled={busy} onClick={() => void submitDecision('accepted')}>{busy ? 'Saving…' : 'Accept and email'}</button><button className="button secondary" disabled={busy} onClick={() => void submitDecision('rejected')}>{busy ? 'Saving…' : 'Reject and email'}</button></div>
    </details>
  </article>;
}

export default App;
