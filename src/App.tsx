import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AuthShell } from './components/auth/AuthShell';
import { Toast } from './components/common/Toast';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { AddFoodModal } from './components/modals/AddFoodModal';
import { TxDetailModal } from './components/modals/TxDetailModal';
import { WithdrawModal } from './components/modals/WithdrawModal';
import { BankScreen } from './components/screens/BankScreen';
import { HoursScreen } from './components/screens/HoursScreen';
import { MenuScreen } from './components/screens/MenuScreen';
import { NotificationsScreen } from './components/screens/NotificationsScreen';
import { OrdersScreen } from './components/screens/OrdersScreen';
import { OverviewScreen } from './components/screens/OverviewScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { SecurityScreen } from './components/screens/SecurityScreen';
import { TransactionsScreen } from './components/screens/TransactionsScreen';
import { WithdrawalsScreen } from './components/screens/WithdrawalsScreen';
import { WEEK_SCHEDULE, type FoodItem, type Notif, type Order, type Txn, type WeekScheduleRow } from './data/mock';
import { auth } from './lib/firebase';
import { getVendorProfile, getVendorUserProfile, isVendorOtpVerified, signOutVendor } from './services/vendorAuth';
import {
  advanceVendorOrderStatus,
  archiveVendorProduct,
  bulkUpdateVendorProducts,
  buildChartFromTransactions,
  createWithdrawal,
  fetchVendorNotifications,
  fetchVendorOrders,
  fetchVendorProducts,
  fetchVendorStoreControls,
  fetchVendorStore,
  fetchWalletOverview,
  fetchWalletSummary,
  fetchWalletTransactions,
  fetchWithdrawals,
  reorderVendorProducts,
  markAllVendorNotificationsRead,
  markVendorNotificationRead,
  saveVendorProduct,
  saveVendorStoreControls,
  sendVendorOrderDelay,
  setVendorProductAvailability,
  setVendorProductFeatured,
  setVendorOrderReadyInMinutes,
} from './services/vendorPortal';
import type { VendorProfile, VendorUserProfile } from './types/firebase';
import type { BankAccount, VendorOrder, WalletOverview, WalletSummary, WithdrawalRecord } from './types/portal';
import type { PageKey } from './types/ui';

export const PAGES: Record<PageKey, string> = {
  overview: 'Overview',
  orders: 'Orders',
  menu: 'Menu Items',
  hours: 'Hours & Status',
  profile: 'Store Profile',
  txns: 'Transactions',
  withdrawals: 'Withdrawals',
  bank: 'Bank Account',
  security: 'Security & PIN',
  notifs: 'Notifications',
};

interface Closure { date: string; reason: string; }
interface StoreControls {
  isOpen: boolean;
  pauseUntil: string | null;
  weeklyHours: WeekScheduleRow[];
  holidays: Closure[];
}

function App() {
  const [page, setPage] = useState<PageKey>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authHidden, setAuthHidden] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [userProfile, setUserProfile] = useState<VendorUserProfile | null>(null);
  const [store, setStore] = useState<Record<string, unknown> | null>(null);

  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [chart, setChart] = useState<{ d: string; v: number }[]>([]);
  const [activeOrderTab, setActiveOrderTab] = useState<Order['status']>('new');
  const [kitchenOpen, setKitchenOpen] = useState(true);
  const [schedule, setSchedule] = useState<WeekScheduleRow[]>(WEEK_SCHEDULE);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [storeControls, setStoreControls] = useState<StoreControls | null>(null);
  const [pauseMinutes, setPauseMinutes] = useState(30);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [withdrawProcessing, setWithdrawProcessing] = useState(false);

  const [toast, setToast] = useState({ visible: false, message: '', ok: true });

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [txDetailId, setTxDetailId] = useState<string | null>(null);
  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);

  const initializedAuth = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (!initializedAuth.current) {
        if (!user) {
          setAuthHidden(false);
        } else {
          const verified = await isVendorOtpVerified().catch(() => false);
          setAuthHidden(Boolean(verified));
        }
        initializedAuth.current = true;
      }

      if (!user) {
        setVendorProfile(null);
        setUserProfile(null);
        setStore(null);
        setWallet(null);
        setSummary(null);
        setWithdrawals([]);
        setAuthReady(true);
        return;
      }

      try {
        const otpVerified = await isVendorOtpVerified().catch(() => false);
        if (!otpVerified) {
          setAuthHidden(false);
        }
        const [vendorData, userData, storeData, controls] = await Promise.all([
          getVendorProfile(user.uid),
          getVendorUserProfile(user.uid),
          fetchVendorStore(user.uid),
          fetchVendorStoreControls().catch(() => null),
        ]);
        setVendorProfile(vendorData);
        setUserProfile(userData);
        setStore(storeData);
        if (controls) {
          setStoreControls(controls);
          setKitchenOpen(Boolean(controls.isOpen));
          if (Array.isArray(controls.weeklyHours) && controls.weeklyHours.length) setSchedule(controls.weeklyHours);
          if (Array.isArray(controls.holidays)) setClosures(controls.holidays);
        }
      } catch (error) {
        console.error('Failed to load vendor profile:', error);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const showToast = (message: string, ok = true) => {
    setToast({ visible: true, message, ok });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3500);
  };

  const loadDashboard = async () => {
    if (!currentUser) return;

    setDashboardLoading(true);
    try {
      const [walletData, summaryData, txnData, withdrawalData, orderData, productData, notifData, storeData] = await Promise.all([
        fetchWalletOverview().catch(() => null),
        fetchWalletSummary().catch(() => null),
        fetchWalletTransactions().catch(() => []),
        fetchWithdrawals().catch(() => []),
        fetchVendorOrders(currentUser.uid).catch(() => []),
        fetchVendorProducts(currentUser.uid).catch(() => []),
        fetchVendorNotifications(currentUser.uid).catch(() => []),
        store ? Promise.resolve(store) : fetchVendorStore(currentUser.uid).catch(() => null),
      ]);

      setWallet(walletData);
      setSummary(summaryData);
      setTxns(txnData);
      setWithdrawals(withdrawalData);
      setOrders(orderData);
      setFoodItems(productData.length ? productData : []);
      setNotifs(notifData);
      setChart(buildChartFromTransactions(txnData));
      setStore(storeData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      showToast('Some live data could not be loaded.', false);
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadDashboard();
    }
  }, [currentUser]);

  const unreadCount = notifs.filter((n) => !n.read).length;
  const ordersBadge = orders.filter((o) => o.status === 'new').length;

  const currentTx = txns.find((t) => t.id === txDetailId) || null;
  const editingFood = foodItems.find((f) => f.id === editingFoodId) || null;

  const kitchenName = vendorProfile?.businessName || "Mama's Kitchen";
  const locationLabel = [vendorProfile?.lga, vendorProfile?.state].filter(Boolean).join(', ') || vendorProfile?.address || 'Set your kitchen location';
  const initials = `${userProfile?.firstName?.[0] || kitchenName[0] || currentUser?.email?.[0] || 'V'}${userProfile?.lastName?.[0] || kitchenName[1] || ''}`.toUpperCase();
  const photoUrl = userProfile?.photoUrl || currentUser?.photoURL || '';
  const vendorStatus = vendorProfile?.vendorStatus || vendorProfile?.status || 'pending';
  const availableBalance = wallet?.availableBalance || 0;
  const bankAccount: BankAccount | null = wallet?.bankAccount || null;

  const handleNavigate = (next: PageKey) => {
    setPage(next);
    setSidebarOpen(false);
  };

  const advanceOrder = async (id: string) => {
    const target = orders.find((order) => order.id === id);
    if (!target) return;

    try {
      await advanceVendorOrderStatus(target);
      showToast(`${id} updated`);
      await loadDashboard();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update order', false);
    }
  };

  const rejectOrder = async () => {
    showToast(`Order rejection is not wired yet on the backend.`, false);
  };

  const toggleAvail = async (id: string) => {
    const item = foodItems.find((food) => food.id === id);
    if (!item) return;

    const nextAvail = item.avail === 'hidden' ? 'available' : item.avail === 'available' ? 'soldout' : 'available';
    try {
      await setVendorProductAvailability(id, nextAvail);
      setFoodItems((prev) => prev.map((food) => (food.id !== id ? food : { ...food, avail: nextAvail })));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update product availability', false);
    }
  };

  const deleteFood = async (id: string) => {
    const item = foodItems.find((f) => f.id === id);
    if (!item) return;
    if (!confirm(`Remove "${item.name}" from your menu?`)) return;

    try {
      await archiveVendorProduct(id);
      setFoodItems((prev) => prev.filter((f) => f.id !== id));
      showToast(`${item.name} removed from menu`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to remove menu item', false);
    }
  };

  const saveFood = async (item: Omit<FoodItem, 'id' | 'emoji'> & { id?: string; emoji?: string }) => {
    if (!currentUser) {
      showToast('Please sign in again.', false);
      return;
    }

    // Check if profile is complete before adding food
    if (!item.id && !vendorProfile?.profileComplete) {
      showToast('Please complete your store profile before adding food items.', false);
      setFoodModalOpen(false);
      return;
    }

    try {
      const id = await saveVendorProduct({
        item,
        vendorProfile,
        userProfile,
        uid: currentUser.uid,
        store,
      });

      const nextItem: FoodItem = {
        id,
        name: item.name,
        cat: item.cat,
        price: item.price,
        desc: item.desc,
        prep: item.prep,
        avail: item.avail,
        tags: item.tags,
        emoji: item.emoji || (item.cat === 'rice' ? '🍛' : item.cat === 'soup' ? '🥣' : item.cat === 'protein' ? '🍗' : '🥤'),
        image: item.image || '',
        featured: Boolean(item.featured),
        menuOrder: Number(item.menuOrder || Date.now()),
      };

      setFoodItems((prev) => {
        const exists = prev.some((food) => food.id === id);
        return exists ? prev.map((food) => (food.id === id ? nextItem : food)) : [nextItem, ...prev];
      });
      showToast(item.id ? `${item.name} updated!` : `${item.name} added to your menu!`);
      setFoodModalOpen(false);
      setEditingFoodId(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save food item', false);
    }
  };

  const toggleDay = (idx: number) => {
    setSchedule((prev) => prev.map((r, i) => (i === idx ? { ...r, open: !r.open } : r)));
  };

  const updateHour = (idx: number, field: 'from' | 'to', value: string) => {
    setSchedule((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addClosure = (date: string, reason: string) => {
    setClosures((prev) => [...prev, { date, reason }]);
    showToast(`Closure added for ${date}`);
  };

  const removeClosure = (idx: number) => {
    setClosures((prev) => prev.filter((_, i) => i !== idx));
  };

  const markNotifRead = async (id: string) => {
    try {
      await markVendorNotificationRead(id);
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (error) {
      showToast('Failed to mark notification as read', false);
    }
  };

  const markAllRead = async () => {
    try {
      await markAllVendorNotificationsRead(notifs);
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      showToast('Failed to update notifications', false);
    }
  };

  const copyFood = async (id: string) => {
    const source = foodItems.find((item) => item.id === id);
    if (!source || !currentUser) return;
    await saveFood({
      name: `${source.name} (Copy)`,
      cat: source.cat,
      price: source.price,
      desc: source.desc,
      prep: source.prep,
      avail: source.avail,
      tags: [...source.tags],
      emoji: source.emoji,
      image: source.image || '',
      featured: false,
      menuOrder: Date.now(),
    });
  };

  const onBulkAction = async (ids: string[], action: 'soldout' | 'hide' | 'archive') => {
    try {
      await bulkUpdateVendorProducts(ids, action);
      await loadDashboard();
      showToast(`Updated ${ids.length} item(s).`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Bulk update failed', false);
    }
  };

  const onReorder = async (ids: string[]) => {
    try {
      await reorderVendorProducts(ids);
      setFoodItems((prev) => {
        const map = new Map(prev.map((item) => [item.id, item]));
        return ids.map((id, index) => ({ ...(map.get(id) as FoodItem), menuOrder: index + 1 })).filter(Boolean);
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to reorder menu', false);
    }
  };

  const onToggleFeatured = async (id: string, featured: boolean) => {
    try {
      await setVendorProductFeatured(id, featured);
      setFoodItems((prev) => prev.map((item) => (item.id === id ? { ...item, featured } : item)));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update featured item', false);
    }
  };

  const saveControls = async (next: Partial<StoreControls> & { pauseMinutes?: number }) => {
    const payload: StoreControls = {
      isOpen: next.isOpen ?? storeControls?.isOpen ?? kitchenOpen,
      pauseUntil: next.pauseUntil ?? storeControls?.pauseUntil ?? null,
      weeklyHours: next.weeklyHours ?? storeControls?.weeklyHours ?? schedule,
      holidays: next.holidays ?? storeControls?.holidays ?? closures,
    };
    await saveVendorStoreControls({
      isOpen: payload.isOpen,
      pauseMinutes: next.pauseMinutes || 0,
      weeklyHours: payload.weeklyHours,
      holidays: payload.holidays,
      uid: currentUser?.uid,
      storeId: String(store?.id || store?.storeId || ''),
    });
    setStoreControls(payload);
    setKitchenOpen(payload.isOpen);
  };

  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--t2)', padding: '24px' }}>
        <div style={{ width: 'min(360px, 90vw)' }}>
          <div style={{ marginBottom: '10px', fontWeight: 600, letterSpacing: '0.01em' }}>Loading vendor portal...</div>
          <div className="vendor-loading-track" aria-live="polite" aria-label="Loading">
            <div className="vendor-loading-fill" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AuthShell hidden={authHidden} onComplete={() => setAuthHidden(true)} onShowToast={(msg) => showToast(msg)} />

      <div id="app">
        <Sidebar
          page={page}
          onNavigate={handleNavigate}
          ordersBadge={ordersBadge}
          notifBadge={unreadCount}
          open={sidebarOpen}
          kitchenName={kitchenName}
          locationLabel={locationLabel}
          initials={initials}
          vendorStatus={vendorStatus}
          availableBalance={availableBalance}
          photoUrl={photoUrl}
          onSignOut={async () => {
            try {
              await signOutVendor();
              setAuthHidden(false);
              showToast('Signed out successfully.');
            } catch (error) {
              console.error('Sign-out failed:', error);
              showToast('Unable to sign out right now.', false);
            }
          }}
        />

        <div id="content">
          <Topbar
            title={dashboardLoading ? `${PAGES[page]} · Syncing` : PAGES[page]}
            onHamburger={() => setSidebarOpen((s) => !s)}
            onNotifications={() => handleNavigate('notifs')}
            showBellDot={unreadCount > 0}
            initials={initials}
          />

          <div id="main">
            {page === 'overview' && (
              <OverviewScreen
                chart={chart}
                txns={txns}
                wallet={wallet}
                summary={summary}
                onOpenWithdraw={() => setWithdrawOpen(true)}
                onNavigate={handleNavigate}
                onOpenTxDetail={(id) => setTxDetailId(id)}
              />
            )}
            {page === 'menu' && (
              <MenuScreen
                foodItems={foodItems}
                profileComplete={vendorProfile?.profileComplete}
                onOpenAdd={() => { setFoodModalOpen(true); setEditingFoodId(null); }}
                onEdit={(id) => { setEditingFoodId(id); setFoodModalOpen(true); }}
                onCopy={copyFood}
                onDelete={deleteFood}
                onToggleAvail={toggleAvail}
                onToggleFeatured={onToggleFeatured}
                onBulkAction={onBulkAction}
                onReorder={onReorder}
              />
            )}
            {page === 'orders' && (
              <OrdersScreen
                orders={orders}
                activeTab={activeOrderTab}
                onTabChange={setActiveOrderTab}
                onAdvance={advanceOrder}
                onReject={rejectOrder}
                onSetReadyInMinutes={async (id, minutes) => {
                  await setVendorOrderReadyInMinutes(id, minutes);
                  await loadDashboard();
                }}
                onSendDelay={async (id, minutes, reason) => {
                  await sendVendorOrderDelay(id, minutes, reason);
                  showToast('Delay notice sent.');
                }}
                kitchenOpen={kitchenOpen}
                onGoHours={() => handleNavigate('hours')}
              />
            )}
            {page === 'hours' && (
              <HoursScreen
                kitchenOpen={kitchenOpen}
                onToggleKitchen={async () => {
                  try {
                    await saveControls({ isOpen: !kitchenOpen, pauseUntil: null });
                    showToast(!kitchenOpen ? 'Kitchen opened' : 'Kitchen paused');
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Failed to update kitchen status', false);
                  }
                }}
                schedule={schedule}
                onToggleDay={toggleDay}
                onUpdateHour={updateHour}
                onSaveSettings={async () => {
                  try {
                    await saveControls({ weeklyHours: schedule, holidays: closures });
                    showToast('Delivery settings saved!');
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Failed to save settings', false);
                  }
                }}
                closures={closures}
                onAddClosure={async (date, reason) => {
                  addClosure(date, reason);
                  try {
                    const next = [...closures, { date, reason }];
                    await saveControls({ holidays: next });
                  } catch {}
                }}
                onRemoveClosure={async (idx) => {
                  const next = closures.filter((_, i) => i !== idx);
                  removeClosure(idx);
                  try {
                    await saveControls({ holidays: next });
                  } catch {}
                }}
                pauseMinutes={pauseMinutes}
                onPauseMinutesChange={setPauseMinutes}
                onPauseStore={async () => {
                  try {
                    await saveControls({ isOpen: false, pauseMinutes });
                    showToast(`Store paused for ${pauseMinutes} minutes`);
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Failed to pause store', false);
                  }
                }}
              />
            )}
            {page === 'profile' && (
              <ProfileScreen
                onShowToast={(msg) => showToast(msg)}
                uid={currentUser?.uid}
                onProfileSaved={() => setVendorProfile((prev) => prev ? { ...prev, profileComplete: true } : prev)}
              />
            )}
            {page === 'txns' && (
              <TransactionsScreen txns={txns} onOpenTxDetail={(id) => setTxDetailId(id)} />
            )}
            {page === 'withdrawals' && (
              <WithdrawalsScreen withdrawals={withdrawals} onOpenWithdraw={() => setWithdrawOpen(true)} />
            )}
            {page === 'bank' && (
              <BankScreen 
                onShowToast={(msg) => showToast(msg)} 
                bankAccount={bankAccount}
                onBankAccountChange={(account) => setWallet(prev => prev ? { ...prev, bankAccount: account } : null)}
              />
            )}
            {page === 'security' && (
              <SecurityScreen onShowToast={(msg) => showToast(msg)} />
            )}
            {page === 'notifs' && (
              <NotificationsScreen notifs={notifs} onRead={markNotifRead} onMarkAllRead={markAllRead} />
            )}
          </div>
        </div>
      </div>

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onShowToast={(msg) => showToast(msg)}
        availableBalance={availableBalance}
        bankAccount={bankAccount}
        processing={withdrawProcessing}
        onSubmit={async ({ amount, pin }) => {
          try {
            setWithdrawProcessing(true);
            await createWithdrawal({ amount, pin });
            await loadDashboard();
          } finally {
            setWithdrawProcessing(false);
          }
        }}
      />
      <TxDetailModal open={!!txDetailId} tx={currentTx} onClose={() => setTxDetailId(null)} />
      <AddFoodModal open={foodModalOpen} editingItem={editingFood} onClose={() => { setFoodModalOpen(false); setEditingFoodId(null); }} onSave={saveFood} />

      <div id="sidebar-overlay" className={sidebarOpen ? 'open' : ''} onClick={() => setSidebarOpen(false)}></div>

      <Toast visible={toast.visible} message={toast.message} ok={toast.ok} />
    </>
  );
}

export default App;
