import {
  ArrowLeft,
  CreditCard,
  Eye,
  EyeOff,
  Home,
  LogOut,
  Mail,
  Smartphone,
  User,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { getAuth, logout } from "../services/auth";

const ACCOUNT_KEY = "gizapp-account";

type AccountForm = {
  name: string;
  cpf: string;
  email: string;
  phone: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  pixKey: string;
  cardNumber: string;
  cardExpiration: string;
};

const EMPTY: AccountForm = {
  name: "", cpf: "", email: "", phone: "",
  cep: "", address: "", number: "", complement: "", neighborhood: "",
  pixKey: "", cardNumber: "", cardExpiration: "",
};

function load(): AccountForm {
  try {
    const saved = localStorage.getItem(ACCOUNT_KEY);
    return saved ? { ...EMPTY, ...JSON.parse(saved) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

const num = (v: string) => v.replace(/\D/g, "");
const fmtCPF = (v: string) =>
  num(v).slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
const fmtPhone = (v: string) =>
  num(v).slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
const fmtCEP = (v: string) => num(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
const fmtCard = (v: string) =>
  num(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
const fmtDate = (v: string) =>
  num(v).slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2");

export default function AccountPage() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [form, setForm] = useState<AccountForm>(() => ({
    ...load(),
    name: load().name || auth?.name || "",
    email: load().email || auth?.email || "",
  }));
  const [saved, setSaved] = useState(false);
  const [showCard, setShowCard] = useState(false);

  function update(key: keyof AccountForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(form));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleLogout() {
    logout();
    localStorage.removeItem("gizapp-orders");
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-[#f0f2f7] pb-32">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-[#e8eaf0] px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a]"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#7c3aed]">
              GizApp
            </p>
            <h1 className="text-xl font-black text-[#0f172a]">Minha conta</h1>
          </div>
        </div>
      </header>

      {/* PROFILE BANNER */}
      <div
        className="relative mx-4 mt-4 overflow-hidden rounded-3xl p-5"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, rgba(124,58,237,0.4), transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            <User size={30} className="text-[#a855f7]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-white truncate">
              {auth ? auth.name : "Bem-vindo!"}
            </h2>
            <p className="text-sm text-[#94a3b8] truncate">
              {auth ? auth.email : "Complete seu cadastro"}
            </p>
            {auth && (
              <span className="mt-1 inline-flex items-center rounded-full bg-[#7c3aed]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#c4b5fd]">
                {auth.role}
              </span>
            )}
          </div>
        </div>

        {auth && (
          <button
            onClick={handleLogout}
            className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-black text-white active:scale-95 transition-transform"
          >
            <LogOut size={16} /> Sair da conta
          </button>
        )}
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* DADOS PESSOAIS */}
        <SectionCard icon={<User size={16} className="text-[#7c3aed]" />} title="Dados pessoais">
          <Field label="Nome completo">
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Seu nome"
              className={inputCls}
            />
          </Field>
          <Field label="CPF">
            <input
              value={form.cpf}
              onChange={(e) => update("cpf", fmtCPF(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              className={inputCls}
            />
          </Field>
        </SectionCard>

        {/* CONTATO */}
        <SectionCard icon={<Mail size={16} className="text-[#2563eb]" />} title="Contato">
          <Field label="E-mail">
            <input
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="seu@email.com"
              type="email"
              className={inputCls}
            />
          </Field>
          <Field label="Celular">
            <input
              value={form.phone}
              onChange={(e) => update("phone", fmtPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              inputMode="numeric"
              className={inputCls}
            />
          </Field>
        </SectionCard>

        {/* ENDEREÇO */}
        <SectionCard icon={<Home size={16} className="text-[#ec4899]" />} title="Endereço de entrega">
          <Field label="CEP">
            <input
              value={form.cep}
              onChange={(e) => update("cep", fmtCEP(e.target.value))}
              placeholder="00000-000"
              inputMode="numeric"
              className={inputCls}
            />
          </Field>
          <Field label="Rua / Avenida">
            <input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Nome da rua"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Número">
              <input
                value={form.number}
                onChange={(e) => update("number", e.target.value)}
                placeholder="123"
                className={inputCls}
              />
            </Field>
            <Field label="Complemento">
              <input
                value={form.complement}
                onChange={(e) => update("complement", e.target.value)}
                placeholder="Apto, bloco…"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Bairro">
            <input
              value={form.neighborhood}
              onChange={(e) => update("neighborhood", e.target.value)}
              placeholder="Nome do bairro"
              className={inputCls}
            />
          </Field>
        </SectionCard>

        {/* PIX */}
        <SectionCard icon={<Smartphone size={16} className="text-[#16a34a]" />} title="Chave Pix">
          <Field label="Chave Pix">
            <input
              value={form.pixKey}
              onChange={(e) => update("pixKey", e.target.value)}
              placeholder="CPF, e-mail, celular ou chave aleatória"
              className={inputCls}
            />
          </Field>
        </SectionCard>

        {/* CARTÃO */}
        <SectionCard icon={<CreditCard size={16} className="text-[#f59e0b]" />} title="Cartão de crédito">
          <Field label="Número do cartão">
            <div className="relative">
              <input
                value={form.cardNumber}
                onChange={(e) => update("cardNumber", fmtCard(e.target.value))}
                type={showCard ? "text" : "password"}
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                className={`${inputCls} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowCard((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
              >
                {showCard ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          <Field label="Validade">
            <input
              value={form.cardExpiration}
              onChange={(e) => update("cardExpiration", fmtDate(e.target.value))}
              placeholder="MM/AA"
              inputMode="numeric"
              className={inputCls}
            />
          </Field>
        </SectionCard>

        {/* SAVE */}
        <button
          onClick={handleSave}
          className={`w-full rounded-2xl py-4 text-sm font-black text-white shadow-lg transition-all active:scale-[0.98] ${
            saved
              ? "bg-[#16a34a] shadow-green-200"
              : "bg-gradient-to-r from-[#7c3aed] to-[#2563eb] shadow-[#7c3aed]/30"
          }`}
        >
          {saved ? "✓ Salvo com sucesso!" : "Salvar cadastro"}
        </button>

      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#7c3aed]/30 placeholder:text-[#cbd5e1]";

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f8fafc]">
          {icon}
        </div>
        <h2 className="text-sm font-black text-[#0f172a]">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
        {label}
      </label>
      {children}
    </div>
  );
}
