import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  emptyState,
  orderTotal,
  activeOrderForTable,
  parseMoney,
  money,
  type State,
  type Role,
  type Status,
  type Order,
  type Product,
  type Table,
} from "./store";

import { AuthScreen } from "./AuthScreen";
import {
  getAuthClient,
  getUser,
  getState,
  sendCommand,
  logout as signOut,
  getTeam,
  saveMember,
  ApiError,
  type User,
  type Command,
  type TeamMember,
} from "./api";
import {
  createOrder,
  advanceOrder,
  payOrder,
  upsertProduct,
  removeProduct,
  upsertTable,
  removeTable,
  updateRestaurant,
} from "./commands";

const paths: Record<string, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  kitchen: (
    <>
      <path d="M7 14a5 5 0 0 1-1-9 6 6 0 0 1 12 0 5 5 0 0 1-1 9v6H7zM7 17h10" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="3" />
      <path d="M3 8V5a2 2 0 0 1 2-2h12M16 11h5v5h-5a2.5 2.5 0 0 1 0-5z" />
    </>
  ),
  history: (
    <>
      <path d="M3 11a9 9 0 1 1 3 8M3 4v7h7M12 7v5l3 2" />
    </>
  ),
  settings: (
    <>
      <path d="m10 3-1 3-3 1-3 2 1 3-1 3 3 2 3 1 1 3h4l1-3 3-1 3-2-1-3 1-3-3-2-3-1-1-3z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  bell: (
    <>
      <path d="M5 9a7 7 0 0 1 14 0v5l2 3H3l2-3zM9 21h6" />
    </>
  ),
  logout: (
    <>
      <path d="M9 4H4v16h5M9 12h12m-4-4 4 4-4 4" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2M12 17v.1" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 3C9 2 2 9 5 16s16 4 15-13ZM4 21 15 10" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3h14v19l-3-2-4 2-4-2-3 2zM8 8h8M8 12h8M8 16h4" />
    </>
  ),
  edit: (
    <>
      <path d="m15 4 5 5M4 20l5-1L21 7a3.5 3.5 0 0 0-5-5L4 14z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 9h20M6 15h4" />
    </>
  ),
  cash: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M5 9v6M19 9v6" />
    </>
  ),
  phone: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M10 18h4" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  food: (
    <>
      <path d="M3 18h18M5 16a7 7 0 0 1 14 0M12 7V5M10 5h4M2 21h20" />
    </>
  ),
  drink: (
    <>
      <path d="m5 5 2 16h10l2-16zM4 5h16M12 5l3-4M7 12h10" />
    </>
  ),
  dessert: (
    <>
      <path d="M4 10h16v11H4zM4 15h16M6 10a3 3 0 1 1 6-1 3 3 0 1 1 6 1M12 5V2" />
    </>
  ),
};
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.food}
    </svg>
  );
}
const statusLabels: Record<Status, string> = {
  pending: "Pendiente",
  preparing: "En preparación",
  ready: "Listo para servir",
  delivered: "Por cobrar",
  paid: "Pagado",
  rejected: "Rechazado",
};
const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  mesero: "Mesero",
  cocina: "Cocina",
  caja: "Cajero",
};
type View =
  | "salon"
  | "kitchen"
  | "cash"
  | "history"
  | "products"
  | "tables"
  | "team"
  | "restaurant";
const navGroups = ["Salón", "Cocina", "Caja", "Administración"] as const;
const nav: {
  id: View;
  name: string;
  sidebarName?: string;
  icon: string;
  roles: Role[];
  group: (typeof navGroups)[number];
}[] = [
  {
    id: "salon",
    name: "Salón",
    sidebarName: "Mesas del salón",
    icon: "grid",
    roles: ["admin", "mesero"],
    group: "Salón",
  },
  {
    id: "kitchen",
    name: "Comandas",
    icon: "kitchen",
    roles: ["admin", "cocina"],
    group: "Cocina",
  },
  {
    id: "cash",
    name: "Caja",
    sidebarName: "Cobros",
    icon: "wallet",
    roles: ["admin", "caja"],
    group: "Caja",
  },
  {
    id: "products",
    name: "Carta del restaurante",
    icon: "food",
    roles: ["admin"],
    group: "Administración",
  },
  {
    id: "tables",
    name: "Mesas y zonas",
    icon: "grid",
    roles: ["admin"],
    group: "Administración",
  },
  {
    id: "team",
    name: "Equipo y accesos",
    icon: "users",
    roles: ["admin"],
    group: "Administración",
  },
  {
    id: "history",
    name: "Operaciones",
    icon: "history",
    roles: ["admin", "caja"],
    group: "Administración",
  },
  {
    id: "restaurant",
    name: "Mi restaurante",
    icon: "settings",
    roles: ["admin"],
    group: "Administración",
  },
];
const today = () => localDate(new Date());
function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function time(date: string) {
  return new Date(date).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function elapsed(date: string) {
  const min = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 60000),
  );
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}
function Badge({ status }: { status: Status }) {
  return (
    <span className={`status-badge ${status}`}>{statusLabels[status]}</span>
  );
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <Icon name="leaf" size={26} />
      </span>
      <div>
        <span className="brand-name">
          moyo<span>®</span>
        </span>
        <span className="brand-caption">GESTIÓN DE RESTAURANTE</span>
      </div>
    </div>
  );
}
type Modal =
  | { type: "order"; table: Table }
  | { type: "detail"; id: string }
  | { type: "reject"; id: string }
  | { type: "product"; product?: Product }
  | { type: "table"; table?: Table }
  | { type: "deleteProduct"; product: Product }
  | { type: "deleteTable"; table: Table }
  | { type: "help" }
  | null;
type Commit = (fn: (s: State) => Command, message: string) => Promise<boolean>;
function Dialog({
  title,
  subtitle,
  children,
  onClose,
  size = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  return (
    <dialog
      className={`dialog ${size}`}
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-button dialog-close"
          aria-label="Cerrar ventana"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function App() {
  const [state, setState] = useState<State>(emptyState),
    stateRef = useRef(state);
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [online, setOnline] = useState(false),
    [busy, setBusy] = useState(false);
  const mutationRef = useRef(false),
    dataEpoch = useRef(0);
  const [view, setView] = useState<View>("salon"),
    [modal, setModal] = useState<Modal>(null),
    [mobile, setMobile] = useState(false);
  const [toasts, setToasts] = useState<
    { id: number; message: string; error: boolean }[]
  >([]);
  const [, setTick] = useState(0);
  const toast = (message: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, message, error }]);
    setTimeout(() => setToasts((x) => x.filter((t) => t.id !== id)), 5000);
  };
  const commit: Commit = async (fn, message) => {
    if (mutationRef.current) return false;
    mutationRef.current = true;
    dataEpoch.current++;
    setBusy(true);
    try {
      const next = await sendCommand(fn(stateRef.current));
      stateRef.current = next;
      setState(next);
      setOnline(true);
      toast(message);
      return true;
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "No se pudo guardar la operación.",
        true,
      );
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setState(emptyState());
      }
      return false;
    } finally {
      mutationRef.current = false;
      setBusy(false);
    }
  };
  async function refresh() {
    const next = await getState();
    stateRef.current = next;
    setState(next);
    setOnline(true);
  }
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const session = await getAuthClient().getSession();
        if (session.error) throw new Error("No se pudo consultar la sesión.");
        if (session.data?.user) {
          const u = await getUser();
          const next = await getState();
          if (!disposed) {
            stateRef.current = next;
            setState(next);
            setUser(u);
            setOnline(true);
            setView(nav.find((n) => n.roles.includes(u.role))!.id);
          }
        }
      } catch (e) {
        if (!(e instanceof ApiError && [401, 403].includes(e.status)))
          setLoadError(
            e instanceof Error
              ? e.message
              : "No se pudo conectar con el servicio.",
          );
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const epoch = dataEpoch.current;
      if (!document.hidden && !mutationRef.current) {
        try {
          const next = await getState();
          if (active && !mutationRef.current && dataEpoch.current === epoch) {
            stateRef.current = next;
            setState(next);
            setOnline(true);
          }
        } catch (e) {
          if (active) {
            setOnline(false);
            if (e instanceof ApiError && [401, 403].includes(e.status)) {
              setUser(null);
              setModal(null);
            }
          }
        }
      }
      if (active) timer = setTimeout(poll, 10000);
    }
    timer = setTimeout(poll, 10000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const allowed = nav.filter((n) => n.roles.includes(user.role));
    if (!allowed.some((n) => n.id === view)) setView(allowed[0].id);
  }, [user, view]);
  useEffect(() => {
    if (user) history.replaceState(null, "", `#${view}`);
  }, [view, user]);
  const changeView = (v: View) => {
    setView(v);
    setMobile(false);
  };
  async function login(u: User) {
    setLoading(true);
    setLoadError("");
    try {
      await refresh();
      setUser(u);
      setView(nav.find((n) => n.roles.includes(u.role))!.id);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "No se pudo cargar el restaurante.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function logout() {
    try {
      await signOut();
      setUser(null);
      setState(emptyState());
      setModal(null);
      setOnline(false);
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "No se pudo cerrar la sesión.",
        true,
      );
    }
  }
  if (loading)
    return (
      <div className="loading-screen">
        <Brand />
        <span className="pending-indicator" />
        <h2>Conectando con tu restaurante</h2>
        <p>Consultando tu sesión y la base de datos.</p>
      </div>
    );
  if (!user && loadError)
    return (
      <div className="error-screen">
        <Brand />
        <h2>No se pudo cargar el restaurante</h2>
        <p role="alert">{loadError}</p>
        <button className="button primary" onClick={() => setLoadError("")}>
          Volver al acceso
        </button>
      </div>
    );
  if (!user) return <AuthScreen onLogin={login} />;
  const active = state.orders.filter(
      (o) => !["paid", "rejected"].includes(o.status),
    ),
    ready = active.filter((o) => o.status === "ready");
  const current = nav.find((n) => n.id === view)!;
  const title = {
    salon: "Cada mesa, bajo control.",
    kitchen: "El buen sabor empieza aquí.",
    cash: "Cuentas claras. Servicio completo.",
    history: "Cada operación, en detalle.",
    products: "Una carta con tu propio sabor.",
    tables: "Un lugar para cada cliente.",
    team: "Tu equipo, bien conectado.",
    restaurant: "Tu restaurante, a tu manera.",
  }[view];
  const subtitle = {
    salon: "Una vista de tu salón para que el servicio nunca se detenga.",
    kitchen: "Organiza las comandas y mantén al salón al tanto de cada pedido.",
    cash: "Revisa los consumos y registra el pago de las mesas atendidas.",
    history: "Consulta pedidos, revisa pagos y encuentra lo que necesitas.",
    products: "Registra tus platos, bebidas y precios reales.",
    tables: "Organiza las mesas de tu salón y sus zonas.",
    team: "Autoriza al personal por correo y asigna sus responsabilidades.",
    restaurant: "Personaliza los datos de tu establecimiento.",
  }[view];
  const close = () => setModal(null);
  const order =
    modal && "id" in modal
      ? state.orders.find((o) => o.id === modal.id)
      : undefined;
  return (
    <>
      <div className="app-layout">
        {mobile && (
          <button
            className="sidebar-backdrop"
            aria-label="Cerrar menú"
            onClick={() => setMobile(false)}
          />
        )}
        <aside className={`sidebar ${mobile ? "open" : ""}`}>
          <Brand />
          {navGroups.map(
            (group) =>
              nav.some(
                (n) => n.group === group && n.roles.includes(user.role),
              ) && (
                <React.Fragment key={group}>
                  <div className="sidebar-label">{group}</div>
                  <nav className="nav-list" aria-label={group}>
                    {nav
                      .filter(
                        (n) => n.group === group && n.roles.includes(user.role),
                      )
                      .map((n) => (
                        <button
                          className={
                            "nav-item " + (view === n.id ? "active" : "")
                          }
                          key={n.id}
                          onClick={() => changeView(n.id)}
                        >
                          <Icon name={n.icon} />
                          <span>{n.sidebarName ?? n.name}</span>
                          {n.id === "kitchen" &&
                            active.filter((o) =>
                              ["pending", "preparing"].includes(o.status),
                            ).length > 0 && (
                              <span className="nav-count">
                                {
                                  active.filter((o) =>
                                    ["pending", "preparing"].includes(o.status),
                                  ).length
                                }
                              </span>
                            )}
                        </button>
                      ))}
                  </nav>
                </React.Fragment>
              ),
          )}
          <div className="sidebar-bottom">
            <div className="storage-note">
              <Icon name="check" size={17} />
              <div>
                <strong>
                  {online ? "Conectado a Neon" : "Conexión pendiente"}
                </strong>
                <span>Datos de tu restaurante</span>
              </div>
            </div>
            <button
              className="nav-item"
              onClick={() => setModal({ type: "help" })}
            >
              <Icon name="help" />
              <span>Guía de uso</span>
            </button>
            <div className="profile">
              <div className="avatar">{user.name.substring(0, 1)}</div>
              <div className="profile-copy">
                <strong>{user.name}</strong>
                <span>{roleLabels[user.role]}</span>
              </div>
              <button
                className="icon-button"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                onClick={logout}
              >
                <Icon name="logout" size={18} />
              </button>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Abrir menú"
                onClick={() => setMobile(true)}
              >
                <Icon name="menu" />
              </button>
              <span>{state.restaurant.name}</span>
              <span className="breadcrumb-slash">/</span>
              <strong>{current.name}</strong>
            </div>
            <div className="topbar-right">
              <span className={"connection " + (online ? "online" : "offline")}>
                {busy ? (
                  <>
                    <span className="pending-indicator" />
                    Guardando...
                  </>
                ) : online ? (
                  "Conectado a Neon"
                ) : (
                  "Sin conexión"
                )}
              </span>
              <span className="date-display">
                {new Date().toLocaleDateString("es-PE", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <button
                className="icon-button notification-button"
                aria-label={`${ready.length} pedidos listos para servir`}
                onClick={async () => {
                  if (user.role === "admin" || user.role === "mesero")
                    changeView("salon");
                  else if (user.role === "cocina") changeView("kitchen");
                  else
                    toast(
                      `${active.filter((o) => o.status === "delivered").length} mesas pendientes de cobro`,
                    );
                }}
              >
                <Icon name="bell" />
                {ready.length > 0 && <span className="notification-dot" />}
              </button>
            </div>
          </header>
          <main className="page-content">
            {!online && (
              <div className="notice" role="alert">
                No se pudo actualizar la información. Revisa la conexión antes
                de registrar cambios.
              </div>
            )}
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {view === "salon"
                    ? "EL SERVICIO DE HOY"
                    : current.name.toUpperCase()}
                </div>
                <h1>{title}</h1>
                <p className="page-subtitle">{subtitle}</p>
              </div>
              <div className="heading-actions">
                {view === "history" && (
                  <button
                    className="button secondary"
                    onClick={async () => {
                      download(
                        `moyo-respaldo-${today()}.json`,
                        JSON.stringify(state, null, 2),
                        "application/json",
                      );
                      toast("Respaldo descargado.");
                    }}
                  >
                    <Icon name="download" size={18} />
                    Respaldar datos
                  </button>
                )}
              </div>
            </div>
            {view === "salon" &&
              user.role === "admin" &&
              (!state.products.length || !state.tables.length) && (
                <div className="initial-setup-panel">
                  <div>
                    <span className="eyebrow">CONFIGURA TU SERVICIO</span>
                    <h2>Tu restaurante empieza contigo.</h2>
                    <p>
                      Añade tu carta y distribuye tus mesas para comenzar a
                      registrar pedidos.
                    </p>
                  </div>
                  <div className="setup-steps">
                    <button
                      className="button primary"
                      onClick={() => changeView("products")}
                    >
                      <Icon name="food" />
                      Configurar carta
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => changeView("tables")}
                    >
                      <Icon name="grid" />
                      Añadir mesas
                    </button>
                  </div>
                </div>
              )}
            {view === "salon" && (
              <Salon
                state={state}
                user={user}
                onOrder={(table) => setModal({ type: "order", table })}
                onDetail={(id) => setModal({ type: "detail", id })}
              />
            )}{" "}
            {view === "kitchen" && (
              <Kitchen
                state={state}
                onDetail={(id) => setModal({ type: "detail", id })}
                onAdvance={(o, status) =>
                  commit(
                    (s) => advanceOrder(s, o.id, status),
                    status === "ready"
                      ? "Pedido listo. El salón ya puede confirmar la entrega."
                      : "Preparación iniciada.",
                  )
                }
                onReject={(id) => setModal({ type: "reject", id })}
              />
            )}{" "}
            {view === "cash" && (
              <Cash
                state={state}
                commit={commit}
                onDetail={(id) => setModal({ type: "detail", id })}
              />
            )}{" "}
            {view === "history" && (
              <History
                state={state}
                onDetail={(id) => setModal({ type: "detail", id })}
              />
            )}{" "}
            {["products", "tables", "restaurant"].includes(view) && (
              <Settings
                key={view}
                section={view as "products" | "tables" | "restaurant"}
                state={state}
                commit={commit}
                onModal={setModal}
              />
            )}
            {view === "team" && <Team user={user} />}
            <footer className="footer-note">
              <span>moyo · Hecho para atender mejor.</span>
              <span>
                Moyobamba, Perú <span className="footer-separator">·</span>{" "}
                Gestión conectada a Neon
              </span>
            </footer>
          </main>
        </div>
      </div>
      {modal?.type === "order" && (
        <Dialog
          title={`Nuevo pedido · Mesa ${String(modal.table.number).padStart(2, "0")}`}
          subtitle={`${modal.table.zone} · Hasta ${modal.table.seats} personas`}
          onClose={close}
        >
          <OrderBuilder
            table={modal.table}
            state={state}
            onCancel={close}
            onSubmit={async (draft) => {
              if (
                await commit(
                  (s) =>
                    createOrder(s, {
                      ...draft,
                      tableId: modal.table.id,
                      waiter: user.name,
                    }),
                  "Pedido enviado a cocina.",
                )
              )
                close();
            }}
          />
        </Dialog>
      )}
      {modal?.type === "detail" && order && (
        <Dialog
          title={`Pedido #${order.number}`}
          subtitle={`Mesa ${String(order.tableNumber).padStart(2, "0")} · ${statusLabels[order.status]}`}
          size="medium-dialog"
          onClose={close}
        >
          <div className="dialog-body">
            <OrderDetail order={order} restaurant={state.restaurant.name} />
            {order.rejectionReason && (
              <div className="notice">
                Motivo del rechazo: {order.rejectionReason}
              </div>
            )}
          </div>
          <div className="dialog-footer">
            <button className="button secondary" onClick={close}>
              Cerrar
            </button>
            {order.status === "paid" && (
              <button
                className="button secondary"
                onClick={() => window.print()}
              >
                <Icon name="receipt" size={18} />
                Imprimir constancia
              </button>
            )}
            {order.status === "ready" &&
              ["admin", "mesero"].includes(user.role) && (
                <button
                  className="button primary"
                  onClick={async () => {
                    if (
                      await commit(
                        (s) => advanceOrder(s, order.id, "delivered"),
                        "Entrega confirmada. La mesa está disponible para cobro.",
                      )
                    )
                      close();
                  }}
                >
                  <Icon name="check" size={18} />
                  Confirmar entrega
                </button>
              )}
            {order.status === "delivered" &&
              ["admin", "caja"].includes(user.role) && (
                <button
                  className="button primary"
                  onClick={async () => {
                    close();
                    changeView("cash");
                  }}
                >
                  Ir a caja
                </button>
              )}
          </div>
        </Dialog>
      )}
      {modal?.type === "reject" && order && (
        <Dialog
          title="Observar o rechazar pedido"
          subtitle={`Pedido #${order.number} · Mesa ${order.tableNumber}`}
          size="small-dialog"
          onClose={close}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const reason = String(
                new FormData(e.currentTarget).get("reason") || "",
              );
              if (
                await commit(
                  (s) => advanceOrder(s, order.id, "rejected", reason),
                  "Pedido rechazado. El salón puede revisar el motivo.",
                )
              )
                close();
            }}
          >
            <div className="dialog-body">
              <div className="notice">
                El pedido se cerrará sin cobro y la mesa quedará libre. Comunica
                el motivo al mesero antes de registrar un nuevo pedido.
              </div>
              <div className="field">
                <label htmlFor="reason">Motivo del rechazo</label>
                <textarea
                  id="reason"
                  name="reason"
                  required
                  minLength={5}
                  maxLength={500}
                  placeholder="Describe el motivo para informar al salón."
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button
                type="button"
                className="button secondary"
                onClick={close}
              >
                Cancelar
              </button>
              <button className="button danger">Confirmar rechazo</button>
            </div>
          </form>
        </Dialog>
      )}
      {modal?.type === "product" && (
        <Dialog
          title={modal.product ? "Editar producto" : "Añadir producto"}
          subtitle="Los cambios se aplican a los nuevos pedidos."
          size="small-dialog"
          onClose={close}
        >
          <ProductForm
            product={modal.product}
            onClose={close}
            onSave={async (p) => {
              if (
                await commit((s) => upsertProduct(s, p), "Producto guardado.")
              )
                close();
            }}
          />
        </Dialog>
      )}
      {modal?.type === "table" && (
        <Dialog
          title={modal.table ? "Editar mesa" : "Añadir mesa"}
          size="small-dialog"
          onClose={close}
        >
          <TableForm
            table={modal.table}
            onClose={close}
            onSave={async (t) => {
              if (await commit((s) => upsertTable(s, t), "Mesa guardada."))
                close();
            }}
          />
        </Dialog>
      )}
      {modal?.type === "deleteProduct" && (
        <Dialog title="Eliminar producto" size="small-dialog" onClose={close}>
          <div className="dialog-body">
            <p>
              ¿Eliminar «{modal.product.name}» de la carta? Los pedidos
              anteriores conservarán su detalle.
            </p>
          </div>
          <div className="dialog-footer">
            <button className="button secondary" onClick={close}>
              Cancelar
            </button>
            <button
              className="button danger"
              onClick={async () => {
                if (
                  await commit(
                    (s) => removeProduct(s, modal.product.id),
                    "Producto eliminado.",
                  )
                )
                  close();
              }}
            >
              Eliminar producto
            </button>
          </div>
        </Dialog>
      )}
      {modal?.type === "deleteTable" && (
        <Dialog title="Eliminar mesa" size="small-dialog" onClose={close}>
          <div className="dialog-body">
            <p>
              ¿Eliminar la mesa {modal.table.number}? Solo se pueden eliminar
              mesas libres.
            </p>
          </div>
          <div className="dialog-footer">
            <button className="button secondary" onClick={close}>
              Cancelar
            </button>
            <button
              className="button danger"
              onClick={async () => {
                if (
                  await commit(
                    (s) => removeTable(s, modal.table.id),
                    "Mesa eliminada.",
                  )
                )
                  close();
              }}
            >
              Eliminar mesa
            </button>
          </div>
        </Dialog>
      )}
      {modal?.type === "help" && (
        <Dialog
          title="Todo listo para tu próximo servicio"
          subtitle="Guía rápida de Moyo"
          size="medium-dialog"
          onClose={close}
        >
          <div className="dialog-body help-content">
            <ol>
              <li>
                <strong>Salón:</strong> elige una mesa libre, añade platos e
                indicaciones y envía el pedido.
              </li>
              <li>
                <strong>Cocina:</strong> inicia la preparación y marca la
                comanda como lista.
              </li>
              <li>
                <strong>Salón:</strong> abre la mesa y confirma que entregaste
                los platos.
              </li>
              <li>
                <strong>Caja:</strong> selecciona la mesa, registra el pago
                completo y libera la mesa.
              </li>
            </ol>
            <h3>Accesos y datos compartidos</h3>
            <p>
              Cada integrante utiliza su correo verificado. El administrador
              autoriza al personal en Equipo y accesos y asigna el rol
              correspondiente.
            </p>
            <div className="notice">
              <strong>Información guardada en Neon</strong>
              <p>
                Los productos, mesas, pedidos y pagos se consultan en la base de
                datos del restaurante. Las pantallas se actualizan cada diez
                segundos mientras están abiertas.
              </p>
              <p>
                Los pagos con tarjeta, Yape o Plin se verifican externamente
                antes de registrarlos. La constancia de pago no sustituye una
                boleta o factura.
              </p>
            </div>
            <p>
              Para usar Live Server conserva el backend activo. Consulta README
              para ejecutar o publicar en Netlify.
            </p>
          </div>
          <div className="dialog-footer">
            <button className="button primary" onClick={close}>
              Entendido
            </button>
          </div>
        </Dialog>
      )}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.error ? "error" : "success"}`}>
            <Icon name={t.error ? "close" : "check"} size={20} />
            <span>{t.message}</span>
            <button
              className="icon-button"
              aria-label="Cerrar aviso"
              onClick={() => setToasts((x) => x.filter((v) => v.id !== t.id))}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  foot,
  trend,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  foot: string;
  trend?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon ${icon}`}>
          <Icon name={icon} size={19} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        {trend && <span className="stat-trend">{trend}</span>}
        {foot}
      </div>
    </div>
  );
}
function Empty({
  icon = "receipt",
  title,
  text,
}: {
  icon?: string;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Salon({
  state,
  user,
  onOrder,
  onDetail,
}: {
  state: State;
  user: User;
  onOrder: (t: Table) => void;
  onDetail: (id: string) => void;
}) {
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [zone, setZone] = useState("all");
  const active = state.orders.filter(
    (o) => !["paid", "rejected"].includes(o.status),
  );
  const free = state.tables.filter(
      (t) => !activeOrderForTable(state, t.id),
    ).length,
    ready = active.filter((o) => o.status === "ready").length;
  const income = state.orders
    .filter(
      (o) =>
        o.status === "paid" &&
        o.payment &&
        localDate(new Date(o.payment.paidAt)) === today(),
    )
    .reduce((s, o) => s + orderTotal(o), 0);
  const tables = state.tables.filter((t) => {
    const o = activeOrderForTable(state, t.id);
    return (
      (filter === "all" ||
        (filter === "free"
          ? !o
          : filter === "ready"
            ? o?.status === "ready"
            : !!o)) &&
      (zone === "all" || t.zone === zone) &&
      `${t.number} ${t.zone} mesa ${String(t.number).padStart(2, "0")}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });
  const zones = [...new Set(state.tables.map((t) => t.zone))];
  return (
    <>
      <div className="stats-grid">
        <Stat
          icon="grid"
          label="Mesas disponibles"
          value={
            <>
              {free}
              <small> / {state.tables.length}</small>
            </>
          }
          foot="Listas para recibir clientes"
        />
        <Stat
          icon="receipt"
          label="Pedidos en curso"
          value={active.length.toString().padStart(2, "0")}
          foot="Entre salón y cocina"
        />
        <Stat
          icon="bell"
          label="Listos para servir"
          value={ready.toString().padStart(2, "0")}
          foot={ready ? "Esperando la entrega" : "Todo al día en el salón"}
          trend={ready ? "Requieren atención" : undefined}
        />
        <Stat
          icon={user.role === "admin" ? "wallet" : "users"}
          label={
            user.role === "admin" ? "Ingresos de hoy" : "Comensales en salón"
          }
          value={
            user.role === "admin"
              ? money(income)
              : active.reduce((s, o) => s + o.guests, 0)
          }
          foot={
            user.role === "admin"
              ? "Pagos registrados en caja"
              : "En mesas con un pedido activo"
          }
        />
      </div>
      <div className="workspace-grid">
        <section className="panel salon-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                Vista del salón{" "}
                <span className="subtle-count">
                  {state.tables.length} mesas
                </span>
              </h2>
              <p className="panel-subtitle">
                Selecciona una mesa para gestionar su atención.
              </p>
            </div>
            <select
              className="filter-select"
              aria-label="Filtrar por zona"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            >
              <option value="all">Todas las zonas</option>
              {zones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </div>
          <div className="toolbar">
            <div className="segmented">
              {[
                ["all", "Todas", state.tables.length],
                ["free", "Libres", free],
                ["occupied", "Ocupadas", active.length],
                ["ready", "Listas", ready],
              ].map(([v, l, c]) => (
                <button
                  className={filter === v ? "active" : ""}
                  key={v}
                  onClick={() => setFilter(String(v))}
                >
                  {l}
                  <span>{c}</span>
                </button>
              ))}
            </div>
            <div className="search-field">
              <Icon name="search" size={17} />
              <input
                aria-label="Buscar mesa"
                placeholder="Buscar mesa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="panel-body table-map">
            {zones
              .filter((z) => tables.some((t) => t.zone === z))
              .map((z) => (
                <section key={z}>
                  <div className="zone-heading">
                    <span>{z}</span>
                    <span>
                      {tables.filter((t) => t.zone === z).length} mesas
                    </span>
                  </div>
                  <div className="table-grid">
                    {tables
                      .filter((t) => t.zone === z)
                      .sort((a, b) => a.number - b.number)
                      .map((t) => {
                        const o = activeOrderForTable(state, t.id);
                        const status = o?.status || "free";
                        return (
                          <button
                            key={t.id}
                            className={`table-card ${status}`}
                            onClick={() => (o ? onDetail(o.id) : onOrder(t))}
                            aria-label={`Mesa ${t.number}, ${o ? statusLabels[o.status] : "libre"}, ${t.seats} personas`}
                          >
                            <div className="table-top">
                              <span className="table-name">
                                Mesa {String(t.number).padStart(2, "0")}
                              </span>
                              <span className="table-capacity">
                                <Icon name="users" size={13} />
                                {o ? `${o.guests}/${t.seats}` : t.seats}
                              </span>
                            </div>
                            <div className="table-drawing">
                              <span className="chair chair-top" />
                              <span className="chair chair-bottom" />
                              {t.seats > 2 && (
                                <>
                                  <span className="chair chair-left" />
                                  <span className="chair chair-right" />
                                </>
                              )}
                              <div className="table-surface">
                                {o && (
                                  <Icon
                                    name={
                                      o.status === "ready"
                                        ? "check"
                                        : o.status === "delivered"
                                          ? "receipt"
                                          : "food"
                                    }
                                    size={23}
                                  />
                                )}
                              </div>
                            </div>
                            <div className="table-status">
                              <span className={`legend-dot ${status}`} />
                              {o ? statusLabels[o.status] : "Libre"}
                            </div>
                            <div className="table-bottom">
                              {o ? (
                                <>
                                  <span>
                                    <Icon name="clock" size={12} />
                                    {elapsed(o.createdAt)}
                                  </span>
                                  <span className="table-amount">
                                    {money(orderTotal(o))}
                                  </span>
                                </>
                              ) : (
                                <span>Disponible para atender</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </section>
              ))}
            {!tables.length && (
              <Empty
                icon="grid"
                title="No hay mesas para mostrar"
                text="Prueba con otro estado, zona o número de mesa."
              />
            )}
            <div className="legend">
              <span>
                <i className="legend-dot free" />
                Libre
              </span>
              <span>
                <i className="legend-dot pending" />
                Pendiente
              </span>
              <span>
                <i className="legend-dot preparing" />
                En preparación
              </span>
              <span>
                <i className="legend-dot ready" />
                Listo
              </span>
              <span>
                <i className="legend-dot delivered" />
                Por cobrar
              </span>
            </div>
          </div>
        </section>
        <aside className="right-column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">El pulso del servicio</h2>
                <p className="panel-subtitle">Lo que está pasando ahora.</p>
              </div>
              <Icon name="history" size={19} />
            </div>
            <div className="activity-list">
              {state.activities.slice(0, 5).map((a) => (
                <div className="activity-item" key={a.id}>
                  <span className={`activity-marker ${a.type}`}>
                    <Icon
                      name={
                        a.type === "payment"
                          ? "wallet"
                          : a.type === "kitchen"
                            ? "kitchen"
                            : a.type === "delivery"
                              ? "check"
                              : a.type === "settings"
                                ? "settings"
                                : "receipt"
                      }
                      size={16}
                    />
                  </span>
                  <div className="activity-copy">
                    <strong>{a.title}</strong>
                    <p>{a.description}</p>
                    <span className="activity-time">{time(a.time)}</span>
                  </div>
                </div>
              ))}
              {!state.activities.length && (
                <p className="panel-body">
                  El próximo pedido iniciará la actividad.
                </p>
              )}
            </div>
          </section>
          <div className="quick-tip">
            <span className="tip-icon">
              <Icon name="leaf" size={23} />
            </span>
            <h3>Cada detalle cuenta.</h3>
            <p>
              Añade las indicaciones especiales al pedido para que cocina las
              tenga siempre a mano.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

type Draft = {
  guests: number;
  items: { productId: string; quantity: number; note?: string }[];
  note: string;
};
function OrderBuilder({
  table,
  state,
  onSubmit,
  onCancel,
}: {
  table: Table;
  state: State;
  onSubmit: (d: Draft) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState("Todos"),
    [search, setSearch] = useState(""),
    [guests, setGuests] = useState(Math.min(2, table.seats)),
    [note, setNote] = useState("");
  const [cart, setCart] = useState<
      { productId: string; quantity: number; note: string }[]
    >([]),
    [error, setError] = useState("");
  const categories = [
    "Todos",
    ...new Set(state.products.map((p) => p.category)),
  ];
  const products = state.products.filter(
    (p) =>
      p.available &&
      (category === "Todos" || category === p.category) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  function quantity(id: string, delta: number) {
    setCart((old) => {
      const item = old.find((i) => i.productId === id);
      return item
        ? old
            .map((i) =>
              i.productId === id
                ? { ...i, quantity: Math.min(99, i.quantity + delta) }
                : i,
            )
            .filter((i) => i.quantity > 0)
        : [...old, { productId: id, quantity: 1, note: "" }];
    });
    setError("");
  }
  const total = cart.reduce(
    (sum, i) =>
      sum +
      (state.products.find((p) => p.id === i.productId)?.price || 0) *
        i.quantity,
    0,
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!cart.length) {
          setError("Añade al menos un producto al pedido.");
          return;
        }
        onSubmit({ guests, items: cart, note });
      }}
    >
      <div className="order-builder">
        <section className="catalog">
          <div className="catalog-toolbar">
            <div className="search-field">
              <Icon name="search" size={18} />
              <input
                aria-label="Buscar producto"
                placeholder="¿Qué desea el cliente?"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="category-tabs">
            {categories.map((c) => (
              <button
                type="button"
                key={c}
                className={c === category ? "active" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="products-grid">
            {products.map((p) => (
              <button
                className="product-card"
                key={p.id}
                type="button"
                onClick={() => quantity(p.id, 1)}
              >
                <span
                  className={`product-visual category-${p.category === "Bebidas" ? "drink" : p.category === "Postres" ? "dessert" : "food"}`}
                >
                  <Icon
                    name={
                      p.category === "Bebidas"
                        ? "drink"
                        : p.category === "Postres"
                          ? "dessert"
                          : "food"
                    }
                    size={35}
                  />
                </span>
                <span className="product-info">
                  <strong>{p.name}</strong>
                  <small>{p.description}</small>
                  <span className="product-price">
                    {money(p.price)}
                    <span className="product-add">
                      <Icon name="plus" size={16} />
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          {!products.length && (
            <Empty
              title="Sin productos disponibles"
              text="Prueba otra categoría o búsqueda."
            />
          )}
        </section>
        <aside className="cart">
          <div className="cart-title">
            <h3>Resumen del pedido</h3>
            <span>{cart.reduce((s, i) => s + i.quantity, 0)} productos</span>
          </div>
          <div className="field">
            <label htmlFor="guests">Número de comensales</label>
            <input
              id="guests"
              type="number"
              min={1}
              max={table.seats}
              required
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
            />
          </div>
          <div className="cart-items">
            {cart.map((i) => {
              const p = state.products.find((p) => p.id === i.productId);
              return (
                <div className="cart-item" key={i.productId}>
                  <div className="cart-item-head">
                    <strong>{p?.name || "Producto"}</strong>
                    <span>{money((p?.price || 0) * i.quantity)}</span>
                  </div>
                  <div className="quantity-control">
                    <button
                      type="button"
                      aria-label={`Quitar uno de ${p?.name}`}
                      onClick={() => quantity(i.productId, -1)}
                    >
                      <Icon name="minus" size={14} />
                    </button>
                    <span aria-live="polite">{i.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Añadir uno de ${p?.name}`}
                      disabled={i.quantity >= 99}
                      onClick={() => quantity(i.productId, 1)}
                    >
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                  <input
                    className="item-note"
                    aria-label={`Indicaciones para ${p?.name}`}
                    value={i.note}
                    maxLength={250}
                    onChange={(e) =>
                      setCart((old) =>
                        old.map((v) =>
                          v.productId === i.productId
                            ? { ...v, note: e.target.value }
                            : v,
                        ),
                      )
                    }
                    placeholder="Indicación para este plato..."
                  />
                </div>
              );
            })}
            {!cart.length && (
              <div className="cart-empty">
                <Icon name="receipt" size={32} />
                <p>El pedido empieza con un buen plato.</p>
                <span>Selecciona productos de la carta.</span>
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="order-note">Observación del pedido</label>
            <textarea
              id="order-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Alergias, preferencias u otra indicación..."
            />
          </div>
          <div className="cart-total">
            <span>Total del pedido</span>
            <strong>{money(total)}</strong>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" type="submit">
            <Icon name="kitchen" size={19} />
            Confirmar y enviar a cocina
          </button>
          <p className="field-hint">
            El pedido enviado no admite ampliaciones.
          </p>
        </aside>
      </div>
      <div className="dialog-footer">
        <button className="button secondary" type="button" onClick={onCancel}>
          Cancelar pedido
        </button>
      </div>
    </form>
  );
}

function Kitchen({
  state,
  onDetail,
  onAdvance,
  onReject,
}: {
  state: State;
  onDetail: (id: string) => void;
  onAdvance: (o: Order, s: Status) => void;
  onReject: (id: string) => void;
}) {
  return (
    <>
      <div className="kitchen-summary">
        <span>
          <Icon name="clock" size={18} />
          Las comandas más antiguas aparecen primero.
        </span>
        <span className="connection">
          <span />
          Actualización en este navegador
        </span>
      </div>
      <div className="kitchen-grid">
        {(["pending", "preparing", "ready"] as Status[]).map((status) => {
          const orders = state.orders
            .filter((o) => o.status === status)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          return (
            <section className={`kitchen-column ${status}`} key={status}>
              <div className="column-header">
                <h2>
                  <span className={`legend-dot ${status}`} />
                  {status === "pending"
                    ? "Pendientes"
                    : status === "preparing"
                      ? "En preparación"
                      : "Listos para servir"}
                </h2>
                <span>{orders.length}</span>
              </div>
              <div className="order-stack">
                {orders.map((o) => (
                  <article className="order-card" key={o.id}>
                    <div className="order-card-head">
                      <div>
                        <span className="eyebrow">PEDIDO #{o.number}</span>
                        <h3>Mesa {String(o.tableNumber).padStart(2, "0")}</h3>
                      </div>
                      <span className="timer">
                        <Icon name="clock" size={14} />
                        {elapsed(o.createdAt)}
                      </span>
                    </div>
                    <div className="order-meta">
                      <span>
                        <Icon name="users" size={14} />
                        {o.guests} personas
                      </span>
                      <span>{time(o.createdAt)}</span>
                    </div>
                    <div className="order-items">
                      {o.items.map((i, index) => (
                        <div key={index}>
                          <div className="item-line">
                            <span className="quantity-badge">
                              {i.quantity}×
                            </span>
                            <strong>{i.name}</strong>
                          </div>
                          {i.note && (
                            <p className="order-item-note">{i.note}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {o.note && (
                      <div className="order-note">
                        <strong>Indicaciones</strong>
                        <p>{o.note}</p>
                      </div>
                    )}
                    <div className="order-card-foot">
                      <button
                        className="button ghost small"
                        onClick={() => onDetail(o.id)}
                      >
                        Ver detalles
                      </button>
                      {status !== "ready" && (
                        <button
                          className="button ghost small reject-button"
                          onClick={() => onReject(o.id)}
                        >
                          Observar
                        </button>
                      )}
                    </div>
                    {status === "pending" && (
                      <button
                        className="button primary"
                        onClick={() => onAdvance(o, "preparing")}
                      >
                        <Icon name="kitchen" size={18} />
                        Iniciar preparación
                      </button>
                    )}
                    {status === "preparing" && (
                      <button
                        className="button primary"
                        onClick={() => onAdvance(o, "ready")}
                      >
                        <Icon name="check" size={18} />
                        Marcar como listo
                      </button>
                    )}
                    {status === "ready" && (
                      <div className="ready-message">
                        <Icon name="bell" size={17} />
                        Esperando entrega del mesero
                      </div>
                    )}
                  </article>
                ))}
                {!orders.length && (
                  <Empty
                    icon={status === "ready" ? "check" : "kitchen"}
                    title={
                      status === "pending"
                        ? "Sin pedidos pendientes"
                        : status === "preparing"
                          ? "La cocina está al día"
                          : "Aquí llegarán los platos listos"
                    }
                    text={
                      status === "pending"
                        ? "Los nuevos pedidos aparecerán aquí."
                        : "El estado se actualizará durante el servicio."
                    }
                  />
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function OrderDetail({
  order: o,
  restaurant,
}: {
  order: Order;
  restaurant: string;
}) {
  return (
    <div className="ticket print-area">
      <div className="ticket-head">
        <span className="ticket-brand">moyo</span>
        <h3>{restaurant}</h3>
        <p>
          {o.payment
            ? "Constancia de pago · Sin valor tributario"
            : "Detalle de consumo"}
        </p>
      </div>
      <div className="ticket-meta">
        <span>
          Pedido <strong>#{o.number}</strong>
        </span>
        <span>
          Mesa <strong>{String(o.tableNumber).padStart(2, "0")}</strong>
        </span>
        <span>
          Fecha{" "}
          <strong>
            {new Date(o.createdAt).toLocaleDateString("es-PE")} ·{" "}
            {time(o.createdAt)}
          </strong>
        </span>
        <span>
          Atendido por <strong>{o.waiter}</strong>
        </span>
      </div>
      <div className="ticket-divider" />
      {o.items.map((i, index) => (
        <div className="ticket-row" key={index}>
          <div>
            <strong>
              {i.quantity} × {i.name}
            </strong>
            <small>{money(i.price)} por unidad</small>
            {i.note && <small>Indicación: {i.note}</small>}
          </div>
          <strong>{money(i.price * i.quantity)}</strong>
        </div>
      ))}
      {o.note && (
        <div className="order-note">
          <strong>Observación</strong>
          <p>{o.note}</p>
        </div>
      )}
      <div className="ticket-total">
        <span>Total</span>
        <strong>{money(orderTotal(o))}</strong>
      </div>
      <p className="field-hint">
        Importe final de la carta. Sin cargos adicionales.
      </p>
      {o.payment && (
        <>
          <div className="ticket-divider" />
          <div className="ticket-row">
            <span>Medio de pago</span>
            <strong>
              {o.payment.method === "cash"
                ? "Efectivo"
                : o.payment.method === "card"
                  ? "Tarjeta"
                  : "Yape / Plin"}
            </strong>
          </div>
          <div className="ticket-row">
            <span>Recibido</span>
            <strong>{money(o.payment.received)}</strong>
          </div>
          <div className="ticket-row">
            <span>Vuelto</span>
            <strong>{money(o.payment.change)}</strong>
          </div>
          {o.payment.reference && (
            <div className="ticket-row">
              <span>Referencia</span>
              <strong>{o.payment.reference}</strong>
            </div>
          )}
          <div className="ticket-footer">
            Pagado el {new Date(o.payment.paidAt).toLocaleDateString("es-PE")} a
            las {time(o.payment.paidAt)}
            <br />
            Gracias por tu visita.
          </div>
        </>
      )}
    </div>
  );
}
function Cash({
  state,
  commit,
  onDetail,
}: {
  state: State;
  commit: Commit;
  onDetail: (id: string) => void;
}) {
  const orders = state.orders
    .filter((o) => o.status === "delivered")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const [selected, setSelected] = useState<string | null>(null),
    [method, setMethod] = useState<"cash" | "card" | "yape">("cash"),
    [received, setReceived] = useState(""),
    [verified, setVerified] = useState(false),
    [reference, setReference] = useState("");
  const o = orders.find((o) => o.id === selected),
    total = o ? orderTotal(o) : 0;
  let receivedAmount = 0;
  try {
    receivedAmount = parseMoney(received);
  } catch {}
  const income = state.orders
    .filter(
      (o) => o.payment && localDate(new Date(o.payment.paidAt)) === today(),
    )
    .reduce((s, o) => s + orderTotal(o), 0);
  function select(id: string) {
    setSelected(id);
    setMethod("cash");
    setReceived("");
    setVerified(false);
    setReference("");
  }
  return (
    <>
      <div className="stats-grid cash-stats">
        <Stat
          icon="wallet"
          label="Ingresos de hoy"
          value={money(income)}
          foot="Pagos registrados en tu restaurante"
        />
        <Stat
          icon="receipt"
          label="Mesas por cobrar"
          value={orders.length}
          foot="Con entrega confirmada"
        />
        <Stat
          icon="cash"
          label="Importe por cobrar"
          value={money(orders.reduce((s, o) => s + orderTotal(o), 0))}
          foot="Consumos pendientes de pago"
        />
      </div>
      <div className="cash-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Mesas por cobrar</h2>
              <p className="panel-subtitle">
                Selecciona una cuenta para continuar.
              </p>
            </div>
          </div>
          <div className="cash-list">
            {orders.map((order) => (
              <button
                className={`cash-table ${o?.id === order.id ? "active" : ""}`}
                key={order.id}
                onClick={() => select(order.id)}
              >
                <div className="cash-table-icon">
                  <Icon name="grid" size={22} />
                </div>
                <div>
                  <strong>
                    Mesa {String(order.tableNumber).padStart(2, "0")}
                  </strong>
                  <span>
                    Pedido #{order.number} · {order.guests} personas
                  </span>
                </div>
                <strong>{money(orderTotal(order))}</strong>
              </button>
            ))}
            {!orders.length && (
              <Empty
                icon="check"
                title="Todas las cuentas al día"
                text="Las mesas aparecerán al confirmar su entrega en el salón."
              />
            )}
          </div>
        </section>
        <section className="panel cash-detail">
          {o ? (
            <>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    Cuenta de la mesa {String(o.tableNumber).padStart(2, "0")}
                  </h2>
                  <p className="panel-subtitle">
                    Revisa el consumo antes de registrar el pago.
                  </p>
                </div>
                <Badge status={o.status} />
              </div>
              <div className="cash-ticket-layout">
                <OrderDetail order={o} restaurant={state.restaurant.name} />
                <form
                  className="payment-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    let amount = 0;
                    try {
                      amount = method === "cash" ? parseMoney(received) : total;
                    } catch {
                      commit(() => {
                        throw Error("Ingresa un monto recibido válido.");
                      }, "");
                      return;
                    }
                    if (
                      await commit(
                        (s) =>
                          payOrder(s, o.id, {
                            method,
                            received: amount,
                            verified,
                            reference,
                          }),
                        "Pago registrado. La mesa ya está libre.",
                      )
                    ) {
                      onDetail(o.id);
                      setSelected(null);
                      setReceived("");
                    }
                  }}
                >
                  <h3>Registrar pago</h3>
                  <label className="field-label">Medio de pago</label>
                  <div className="payment-methods">
                    {(
                      [
                        ["cash", "Efectivo", "cash"],
                        ["card", "Tarjeta", "card"],
                        ["yape", "Yape / Plin", "phone"],
                      ] as const
                    ).map(([m, l, i]) => (
                      <button
                        type="button"
                        className={method === m ? "selected" : ""}
                        key={m}
                        onClick={async () => {
                          setMethod(m);
                          setVerified(false);
                        }}
                      >
                        <Icon name={i} size={20} />
                        {l}
                      </button>
                    ))}
                  </div>
                  {method === "cash" ? (
                    <>
                      <div className="field">
                        <label htmlFor="received">Monto recibido (S/)</label>
                        <input
                          id="received"
                          inputMode="decimal"
                          type="text"
                          value={received}
                          required
                          onChange={(e) => setReceived(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="change-box">
                        <span>Vuelto al cliente</span>
                        <strong>
                          {money(Math.max(0, receivedAmount - total))}
                        </strong>
                      </div>
                      {received && receivedAmount < total && (
                        <p className="form-error">
                          Faltan {money(total - receivedAmount)} para completar
                          el pago.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="notice">
                        Verifica el pago de {money(total)} en tu POS o billetera
                        digital antes de continuar.
                      </div>
                      <div className="field">
                        <label htmlFor="reference">
                          N.º de operación (opcional)
                        </label>
                        <input
                          id="reference"
                          value={reference}
                          maxLength={80}
                          onChange={(e) => setReference(e.target.value)}
                          placeholder="Referencia de la operación"
                        />
                      </div>
                      <label className="checkbox-field">
                        <input
                          type="checkbox"
                          checked={verified}
                          required
                          onChange={(e) => setVerified(e.target.checked)}
                        />
                        Confirmo que verifiqué el pago externamente.
                      </label>
                    </>
                  )}
                  <button
                    className="button primary"
                    type="submit"
                    disabled={
                      method === "cash" ? receivedAmount < total : !verified
                    }
                  >
                    <Icon name="check" size={18} />
                    Registrar pago · {money(total)}
                  </button>
                  <p className="field-hint">
                    Se cerrará el pedido y se liberará la mesa. Solo pagos
                    completos.
                  </p>
                </form>
              </div>
            </>
          ) : (
            <Empty
              icon="wallet"
              title="Un cobro sencillo y ordenado"
              text="Selecciona una mesa de la lista para ver su consumo y registrar el pago."
            />
          )}
        </section>
      </div>
    </>
  );
}

function History({
  state,
  onDetail,
}: {
  state: State;
  onDetail: (id: string) => void;
}) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [status, setStatus] = useState("all"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const rows = state.orders
    .filter((o) => {
      const date = localDate(new Date(o.payment?.paidAt || o.createdAt));
      return (
        (!from || date >= from) &&
        (!to || date <= to) &&
        (status === "all" || o.status === status) &&
        `${o.number} ${o.tableNumber} ${o.waiter}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    })
    .sort((a, b) =>
      (b.payment?.paidAt || b.createdAt).localeCompare(
        a.payment?.paidAt || a.createdAt,
      ),
    );
  const pages = Math.max(1, Math.ceil(rows.length / 8)),
    safePage = Math.min(page, pages);
  const filterChange = (fn: () => void) => {
    fn();
    setPage(1);
  };
  function csv() {
    const cell = (s: unknown) => {
      let val = String(s ?? "");
      if (/^[=+@-]/.test(val)) val = "'" + val;
      return `"${val.replaceAll('"', '""')}"`;
    };
    const data = [
      [
        "Pedido",
        "Mesa",
        "Fecha",
        "Mesero",
        "Estado",
        "Total S/",
        "Medio de pago",
      ],
      ...rows.map((o) => [
        o.number,
        o.tableNumber,
        new Date(o.payment?.paidAt || o.createdAt).toLocaleString("es-PE"),
        o.waiter,
        statusLabels[o.status],
        (orderTotal(o) / 100).toFixed(2),
        o.payment?.method === "cash"
          ? "Efectivo"
          : o.payment?.method === "card"
            ? "Tarjeta"
            : o.payment?.method === "yape"
              ? "Yape / Plin"
              : "",
      ]),
    ];
    download(
      `moyo-operaciones-${today()}.csv`,
      "\uFEFF" + data.map((r) => r.map(cell).join(";")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Historial de operaciones</h2>
          <p className="panel-subtitle">
            {rows.length} registros encontrados · Los detalles se conservan sin
            alteraciones.
          </p>
        </div>
        <button
          className="button secondary small"
          onClick={csv}
          disabled={!rows.length}
        >
          <Icon name="download" size={16} />
          Exportar CSV
        </button>
      </div>
      <div className="history-filters">
        <div className="field">
          <label htmlFor="from">Desde</label>
          <input
            type="date"
            id="from"
            value={from}
            max={to || undefined}
            onChange={(e) => filterChange(() => setFrom(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="to">Hasta</label>
          <input
            type="date"
            id="to"
            value={to}
            min={from || undefined}
            onChange={(e) => filterChange(() => setTo(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="status-filter">Estado</label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => filterChange(() => setStatus(e.target.value))}
          >
            <option value="all">Todos los estados</option>
            {Object.entries(statusLabels).map(([s, l]) => (
              <option value={s} key={s}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="history-search">Buscar operación</label>
          <input
            id="history-search"
            placeholder="Pedido, mesa o mesero"
            value={search}
            onChange={(e) => filterChange(() => setSearch(e.target.value))}
          />
        </div>
        <button
          className="button ghost small"
          onClick={async () => {
            setFrom("");
            setTo("");
            setStatus("all");
            setSearch("");
            setPage(1);
          }}
        >
          Limpiar filtros
        </button>
      </div>
      {rows.length ? (
        <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Mesa</th>
                  <th>Fecha y hora</th>
                  <th>Estado</th>
                  <th>Medio de pago</th>
                  <th>Total</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice((safePage - 1) * 8, safePage * 8).map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>#{o.number}</strong>
                      <small>{o.waiter}</small>
                    </td>
                    <td>Mesa {String(o.tableNumber).padStart(2, "0")}</td>
                    <td>
                      {new Date(
                        o.payment?.paidAt || o.createdAt,
                      ).toLocaleDateString("es-PE")}
                      <small>{time(o.payment?.paidAt || o.createdAt)}</small>
                    </td>
                    <td>
                      <Badge status={o.status} />
                    </td>
                    <td>
                      {o.payment?.method === "cash"
                        ? "Efectivo"
                        : o.payment?.method === "card"
                          ? "Tarjeta"
                          : o.payment?.method === "yape"
                            ? "Yape / Plin"
                            : "—"}
                    </td>
                    <td className="amount-cell">{money(orderTotal(o))}</td>
                    <td>
                      <button
                        className="button ghost small"
                        onClick={() => onDetail(o.id)}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              Mostrando {(safePage - 1) * 8 + 1}–
              {Math.min(safePage * 8, rows.length)} de {rows.length}
            </span>
            <div>
              <button
                className="button secondary small"
                disabled={safePage === 1}
                onClick={() => setPage(safePage - 1)}
              >
                Anterior
              </button>
              <span>
                {safePage} / {pages}
              </span>
              <button
                className="button secondary small"
                disabled={safePage === pages}
                onClick={() => setPage(safePage + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      ) : (
        <Empty
          icon="search"
          title="No se encontraron operaciones"
          text="No hay registros en el rango o estado seleccionado. Prueba con otros filtros."
        />
      )}
    </section>
  );
}

function Settings({
  section,
  state,
  commit,
  onModal,
}: {
  section: "products" | "tables" | "restaurant";
  state: State;
  commit: Commit;
  onModal: (m: Modal) => void;
}) {
  const tab = section;
  const [search, setSearch] = useState("");
  const products = state.products.filter((p) =>
    `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <section className="panel settings-section">
        {tab === "products" && (
          <>
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Tu carta, siempre al día</h2>
                <p className="panel-subtitle">
                  {state.products.length} productos · Los precios de pedidos
                  enviados se mantienen.
                </p>
              </div>
              <button
                className="button primary small"
                onClick={() => onModal({ type: "product" })}
              >
                <Icon name="plus" size={17} />
                Añadir producto
              </button>
            </div>
            <div className="toolbar">
              <div className="search-field">
                <Icon name="search" size={17} />
                <input
                  aria-label="Buscar en la carta"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto o categoría..."
                />
              </div>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Disponibilidad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <small>{p.description}</small>
                      </td>
                      <td>{p.category}</td>
                      <td className="amount-cell">{money(p.price)}</td>
                      <td>
                        <button
                          className={`availability-toggle ${p.available ? "available" : ""}`}
                          aria-label={`${p.name}: ${p.available ? "disponible" : "no disponible"}. Cambiar disponibilidad`}
                          onClick={() =>
                            commit(
                              (s) =>
                                upsertProduct(s, {
                                  ...p,
                                  available: !p.available,
                                }),
                              "Disponibilidad actualizada.",
                            )
                          }
                        >
                          <span />
                          {p.available ? "Disponible" : "No disponible"}
                        </button>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="icon-button"
                            title="Editar producto"
                            aria-label={`Editar ${p.name}`}
                            onClick={() =>
                              onModal({ type: "product", product: p })
                            }
                          >
                            <Icon name="edit" size={17} />
                          </button>
                          <button
                            className="icon-button"
                            title="Eliminar producto"
                            aria-label={`Eliminar ${p.name}`}
                            onClick={() =>
                              onModal({ type: "deleteProduct", product: p })
                            }
                          >
                            <Icon name="trash" size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!products.length && (
              <Empty
                title="No se encontraron productos"
                text="Añade un producto o prueba otra búsqueda."
              />
            )}
          </>
        )}
        {tab === "tables" && (
          <>
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Un lugar para cada cliente</h2>
                <p className="panel-subtitle">
                  Configura los números, la capacidad y las zonas de tus mesas.
                </p>
              </div>
              <button
                className="button primary small"
                onClick={() => onModal({ type: "table" })}
              >
                <Icon name="plus" size={17} />
                Añadir mesa
              </button>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mesa</th>
                    <th>Zona</th>
                    <th>Capacidad</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {[...state.tables]
                    .sort((a, b) => a.number - b.number)
                    .map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong>
                            Mesa {String(t.number).padStart(2, "0")}
                          </strong>
                        </td>
                        <td>{t.zone}</td>
                        <td>{t.seats} personas</td>
                        <td>
                          <span
                            className={`status-badge ${activeOrderForTable(state, t.id) ? "pending" : "free"}`}
                          >
                            {activeOrderForTable(state, t.id)
                              ? "Ocupada"
                              : "Libre"}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="icon-button"
                              aria-label={`Editar mesa ${t.number}`}
                              disabled={!!activeOrderForTable(state, t.id)}
                              onClick={() =>
                                onModal({ type: "table", table: t })
                              }
                            >
                              <Icon name="edit" size={17} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Eliminar mesa ${t.number}`}
                              disabled={!!activeOrderForTable(state, t.id)}
                              onClick={() =>
                                onModal({ type: "deleteTable", table: t })
                              }
                            >
                              <Icon name="trash" size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!state.tables.length && (
              <Empty
                icon="grid"
                title="Configura tu primera mesa"
                text="Añade una mesa para empezar a recibir pedidos."
              />
            )}
          </>
        )}
        {tab === "restaurant" && (
          <>
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Datos del restaurante</h2>
                <p className="panel-subtitle">
                  Personaliza el nombre que aparece en el sistema.
                </p>
              </div>
            </div>
            <form
              className="restaurant-form"
              key={state.restaurant.name}
              onSubmit={async (e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                commit(
                  (s) =>
                    updateRestaurant(s, {
                      name: String(d.get("name")),
                      subtitle: String(d.get("subtitle")),
                    }),
                  "Datos del restaurante actualizados.",
                );
              }}
            >
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="restaurant-name">Nombre comercial</label>
                  <input
                    id="restaurant-name"
                    name="name"
                    defaultValue={state.restaurant.name}
                    maxLength={80}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="restaurant-subtitle">
                    Descripción o ubicación
                  </label>
                  <input
                    id="restaurant-subtitle"
                    name="subtitle"
                    defaultValue={state.restaurant.subtitle}
                    maxLength={100}
                  />
                </div>
              </div>
              <button className="button primary">Guardar cambios</button>
              <div className="notice">
                <strong>Base de datos del restaurante</strong>
                <p>
                  La información se guarda en Neon. Los permisos se comprueban
                  en el servidor y los pedidos mantienen sus precios históricos.
                  Puedes exportar tus operaciones desde el menú Operaciones.
                </p>
              </div>
            </form>
          </>
        )}
      </section>
    </>
  );
}
function Team({ user }: { user: User }) {
  const [members, setMembers] = useState<TeamMember[]>([]),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [editing, setEditing] = useState<TeamMember | null>(null);
  async function reload() {
    setLoading(true);
    try {
      setMembers(await getTeam());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el equipo.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  async function save(input: Parameters<typeof saveMember>[0]) {
    setPending(true);
    setError("");
    setSuccess("");
    try {
      setMembers(await saveMember(input));
      setEditing(null);
      setSuccess(
        "Acceso guardado. El integrante debe registrarse y verificar su correo para ingresar.",
      );
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar el acceso.",
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Personas que hacen el servicio</h2>
            <p className="panel-subtitle">
              Autoriza cada correo y asigna el acceso que necesita.
            </p>
          </div>
          <button
            className="button secondary small"
            onClick={reload}
            disabled={loading}
          >
            Actualizar
          </button>
        </div>
        {error && (
          <div className="panel-body">
            <p className="form-error" role="alert">
              {error}
            </p>
          </div>
        )}
        {success && (
          <div className="panel-body">
            <p className="notice" role="status">
              {success}
            </p>
          </div>
        )}
        <div className="team-list">
          {loading ? (
            <p>Cargando el equipo...</p>
          ) : (
            members.map((m) => (
              <div className="team-member" key={m.id}>
                <div className="avatar">{m.name[0]}</div>
                <div className="team-member-copy">
                  <strong>
                    {m.name}
                    {m.id === user.id ? " (tú)" : ""}
                  </strong>
                  <span>{m.email}</span>
                </div>
                <span className="team-role">{roleLabels[m.role]}</span>
                <span
                  className={`status-badge ${m.active ? "free" : "rejected"}`}
                >
                  {m.active ? "Activo" : "Inactivo"}
                </span>
                <button
                  className="icon-button"
                  aria-label={`Editar acceso de ${m.name}`}
                  onClick={() => {
                    setEditing(m);
                    setError("");
                    setSuccess("");
                  }}
                >
                  <Icon name="edit" size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              {editing ? "Editar acceso" : "Añadir al equipo"}
            </h2>
            <p className="panel-subtitle">
              La cuenta se registra con su propio correo y contraseña.
            </p>
          </div>
        </div>
        <form
          className="team-form"
          key={editing?.id || "new"}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const d = new FormData(form);
            if (
              await save({
                id: editing?.id,
                email: String(d.get("email")),
                name: String(d.get("name")),
                role: String(d.get("role")) as Role,
                active: d.get("active") === "on",
              })
            )
              form.reset();
          }}
        >
          <div className="field">
            <label htmlFor="member-name">Nombre y apellido</label>
            <input
              id="member-name"
              name="name"
              required
              maxLength={100}
              defaultValue={editing?.name}
            />
          </div>
          <div className="field">
            <label htmlFor="member-email">Correo del integrante</label>
            <input
              id="member-email"
              name="email"
              type="email"
              required
              maxLength={254}
              defaultValue={editing?.email}
            />
          </div>
          <div className="field">
            <label htmlFor="member-role">Rol en el restaurante</label>
            <select
              id="member-role"
              name="role"
              defaultValue={editing?.role || "mesero"}
            >
              {Object.entries(roleLabels).map(([r, l]) => (
                <option key={r} value={r}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              name="active"
              defaultChecked={editing?.active ?? true}
            />
            Acceso activo
          </label>
          <button className="button primary" disabled={pending}>
            {pending ? (
              <>
                <span className="pending-indicator" />
                Guardando...
              </>
            ) : editing ? (
              "Guardar acceso"
            ) : (
              "Autorizar integrante"
            )}
          </button>
          {editing && (
            <button
              type="button"
              className="button ghost"
              onClick={() => setEditing(null)}
            >
              Cancelar edición
            </button>
          )}
          <p className="field-hint">
            Registrar un correo aquí autoriza el acceso. La persona debe crear
            su cuenta y verificar el código recibido por correo. No se envían
            invitaciones automáticamente.
          </p>
        </form>
      </section>
    </div>
  );
}

function ProductForm({
  product: p,
  onClose,
  onSave,
}: {
  product?: Product;
  onClose: () => void;
  onSave: (p: {
    id?: string;
    name: string;
    category: string;
    price: number;
    description: string;
    available: boolean;
  }) => void;
}) {
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        try {
          onSave({
            id: p?.id,
            name: String(d.get("name")),
            category: String(d.get("category")),
            price: parseMoney(String(d.get("price"))),
            description: String(d.get("description")),
            available: d.get("available") === "on",
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Precio inválido.");
        }
      }}
    >
      <div className="dialog-body">
        <div className="field">
          <label htmlFor="product-name">Nombre del producto</label>
          <input
            id="product-name"
            name="name"
            required
            maxLength={80}
            defaultValue={p?.name}
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="product-category">Categoría</label>
            <input
              id="product-category"
              name="category"
              list="categories"
              required
              maxLength={40}
              defaultValue={p?.category || "Platos de fondo"}
            />
            <datalist id="categories">
              {["Platos de fondo", "Entradas", "Bebidas", "Postres"].map(
                (c) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="product-price">Precio (S/)</label>
            <input
              id="product-price"
              name="price"
              inputMode="decimal"
              placeholder="0.00"
              required
              defaultValue={p ? (p.price / 100).toFixed(2) : ""}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="product-description">Descripción</label>
          <textarea
            id="product-description"
            name="description"
            maxLength={180}
            defaultValue={p?.description}
          />
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            name="available"
            defaultChecked={p?.available ?? true}
          />
          Disponible para nuevos pedidos
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="dialog-footer">
        <button type="button" className="button secondary" onClick={onClose}>
          Cancelar
        </button>
        <button className="button primary">Guardar producto</button>
      </div>
    </form>
  );
}
function TableForm({
  table: t,
  onClose,
  onSave,
}: {
  table?: Table;
  onClose: () => void;
  onSave: (t: {
    id?: string;
    number: number;
    seats: number;
    zone: string;
  }) => void;
}) {
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        onSave({
          id: t?.id,
          number: Number(d.get("number")),
          seats: Number(d.get("seats")),
          zone: String(d.get("zone")),
        });
      }}
    >
      <div className="dialog-body">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="table-number">Número de mesa</label>
            <input
              id="table-number"
              name="number"
              type="number"
              min={1}
              max={999}
              required
              defaultValue={t?.number}
            />
          </div>
          <div className="field">
            <label htmlFor="table-seats">Capacidad</label>
            <input
              id="table-seats"
              name="seats"
              type="number"
              min={1}
              max={20}
              required
              defaultValue={t?.seats || 4}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="table-zone">Zona</label>
          <input
            id="table-zone"
            name="zone"
            list="zones"
            required
            maxLength={50}
            defaultValue={t?.zone || "Salón principal"}
          />
          <datalist id="zones">
            <option>Salón principal</option>
            <option>Terraza</option>
          </datalist>
        </div>
        <p className="field-hint">
          Las mesas ocupadas conservan los datos del pedido en curso.
        </p>
      </div>
      <div className="dialog-footer">
        <button type="button" className="button secondary" onClick={onClose}>
          Cancelar
        </button>
        <button className="button primary">Guardar mesa</button>
      </div>
    </form>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
