import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HaramaqLogo } from '@/components/haramaq/HaramaqLogo'

const flowSteps = [
  { label: 'WhatsApp', icon: MessageCircle },
  { label: 'IA', icon: Sparkles },
  { label: 'Território', icon: MapPin },
  { label: 'Vendedor', icon: UserRound },
] as const

function FlowCards({ mobileLayout = false }: { mobileLayout?: boolean }) {
  return (
    <ol
      aria-label="Etapas do fluxo comercial: WhatsApp, IA, Território e Vendedor"
      className={mobileLayout ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 gap-2 sm:grid-cols-4'}
    >
      {flowSteps.map((step, index) => {
        const StepIcon = step.icon
        return (
          <li
            key={step.label}
            className="relative min-w-0 rounded-xl border border-white/20 bg-white/[0.09] p-3 shadow-sm backdrop-blur-sm sm:p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15 text-white">
                <StepIcon aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-semibold tabular-nums text-white/60">
                0{index + 1}
              </span>
            </div>
            <div className="mt-3 flex min-w-0 items-center justify-between gap-1">
              <span className="truncate text-xs font-semibold sm:text-sm">{step.label}</span>
              {!mobileLayout && index < flowSteps.length - 1 && (
                <ArrowRight
                  aria-hidden="true"
                  className="hidden h-3.5 w-3.5 shrink-0 text-white/60 sm:block"
                />
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(false)
    setLoading(true)

    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      console.error(err)
      setErrorMsg('E-mail ou senha incorretos. Verifique e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col overflow-x-hidden bg-[#F1F3F5] text-[#1E293B] lg:grid lg:min-h-[100svh] lg:grid-cols-2">
      <section
        aria-labelledby="login-title"
        className="order-1 flex min-w-0 items-center justify-center bg-[#F4F5F6] px-4 py-6 sm:px-8 sm:py-10 lg:order-2 lg:min-h-[100svh] lg:px-10 xl:px-16"
      >
        <div className="mx-auto w-full max-w-[460px] overflow-hidden rounded-3xl border border-[#E2E5E8] bg-white shadow-[0_18px_55px_rgba(30,41,59,0.08)]">
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#D92323] to-[#A91F24] px-5 py-4 text-white sm:px-7 lg:hidden">
            <HaramaqLogo module="" size="md" inverted className="shrink-0" />
            <span aria-hidden="true" className="text-white/55">
              |
            </span>
            <span className="min-w-0 text-sm font-semibold tracking-tight sm:text-base">
              Inteligência Comercial
            </span>
          </div>

          <div className="p-6 sm:p-9 lg:p-10">
            <div className="mb-8">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#F2D5D5] bg-[#FFF7F7] px-3 py-1.5 text-[11px] font-semibold text-[#A91F24]">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#D92323]" />
                Acesso à conta
              </div>
              <h2
                id="login-title"
                className="text-2xl font-semibold tracking-tight text-[#1E293B] sm:text-3xl"
              >
                Acesse sua conta
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
                Entre com suas credenciais para continuar.
              </p>
            </div>

            {errorMsg && (
              <div
                id="login-error"
                role="alert"
                aria-live="assertive"
                className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#D92323]"
                />
                <span>{errorMsg}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              aria-describedby={errorMsg ? 'login-error' : undefined}
              aria-busy={loading}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-[#344054]">
                  E-mail corporativo
                </Label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#84909D]"
                  />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@haramaq.com.br"
                    required
                    className="h-12 rounded-xl border-[#D9DEE4] bg-white pl-11 text-sm text-[#1E293B] placeholder:text-[#98A2B3] focus-visible:border-[#D92323] focus-visible:ring-[#D92323]/25"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pass" className="text-sm font-medium text-[#344054]">
                  Senha
                </Label>
                <div className="relative">
                  <Lock
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#84909D]"
                  />
                  <Input
                    id="pass"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    required
                    className="h-12 rounded-xl border-[#D9DEE4] bg-white py-2 pl-11 pr-12 text-sm text-[#1E293B] placeholder:text-[#98A2B3] focus-visible:border-[#D92323] focus-visible:ring-[#D92323]/25"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                    aria-controls="pass"
                    className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[#667085] transition-colors hover:bg-[#F2F4F7] hover:text-[#344054] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D92323] focus-visible:ring-offset-1"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" className="h-[18px] w-[18px]" />
                    ) : (
                      <Eye aria-hidden="true" className="h-[18px] w-[18px]" />
                    )}
                  </button>
                </div>
              </div>

              {/* "Lembrar de mim" oculto nesta integração: a persistência de
                  sessão é a padrão do PocketBase (localStorage via authStore).
                  Reativar exige uma política de sessão validada. */}

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 h-12 w-full rounded-xl bg-[#D92323] text-sm font-semibold text-white shadow-[0_6px_14px_rgba(217,35,35,0.18)] transition-colors hover:bg-[#B91C1C] focus-visible:ring-2 focus-visible:ring-[#D92323] focus-visible:ring-offset-2 active:bg-[#991B1B] disabled:pointer-events-none disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    <span>Autenticando...</span>
                  </span>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs leading-relaxed text-[#667085]">
              Utilize as credenciais associadas à sua conta HARAMAQ.
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="login-brand-title"
        className="relative isolate order-2 hidden min-w-0 flex-col overflow-hidden bg-gradient-to-br from-[#D92323] via-[#C72125] to-[#941B20] px-5 py-8 text-white sm:px-8 sm:py-10 lg:order-1 lg:flex lg:min-h-[100svh] lg:justify-between lg:px-10 lg:py-12 xl:px-14"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full border border-white/10 bg-white/[0.04] sm:h-96 sm:w-96"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 -left-36 h-[26rem] w-[26rem] rounded-full border border-white/10"
        />

        <div className="relative z-10 flex flex-col gap-9 lg:gap-14">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <HaramaqLogo module="" size="md" inverted className="shrink-0" />
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-white sm:text-base">
              <span aria-hidden="true" className="text-white/55">
                |
              </span>
              <span>Inteligência Comercial</span>
            </div>
          </div>

          <div className="max-w-2xl">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/75">
              Inteligência para conectar
            </p>
            <h1
              id="login-brand-title"
              className="max-w-xl text-3xl font-semibold leading-[1.12] tracking-tight sm:text-4xl xl:text-5xl"
            >
              Conectando oportunidades aos vendedores certos.
            </h1>

            <div className="mt-8 sm:mt-10">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                  Fluxo
                </span>
                <span aria-hidden="true" className="h-px flex-1 bg-white/25" />
              </div>
              <FlowCards />
            </div>
          </div>
        </div>

        <footer className="relative z-10 mt-8 flex flex-col gap-2 border-t border-white/20 pt-4 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between lg:mt-12">
          <span>HARAMAQ | Inteligência Comercial</span>
          <span>WhatsApp → IA → Território → Vendedor</span>
        </footer>
      </section>

      <section aria-labelledby="mobile-flow-title" className="order-3 px-4 pb-8 pt-1 lg:hidden">
        <div className="rounded-2xl bg-gradient-to-br from-[#D92323] via-[#C72125] to-[#941B20] px-5 py-6 text-white shadow-lg sm:px-7">
          <div className="mb-4 flex items-center gap-3">
            <h2
              id="mobile-flow-title"
              className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/90"
            >
              Fluxo
            </h2>
            <span aria-hidden="true" className="h-px flex-1 bg-white/30" />
          </div>
          <FlowCards mobileLayout />
          <footer className="mt-5 border-t border-white/20 pt-4 text-xs text-white/80">
            HARAMAQ | Inteligência Comercial
          </footer>
        </div>
      </section>
    </main>
  )
}
