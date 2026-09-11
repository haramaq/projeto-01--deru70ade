import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { HaramaqLogo } from '@/components/haramaq/HaramaqLogo'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('elisandrodesousaharamaq@gmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
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
    <div className="flex min-h-screen bg-[#F1F3F5]">
      {/* Brand Panel - Left Side (Desktop Only) with Haramaq Red & White identity */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#D92323] text-white flex-col justify-between p-12 relative overflow-hidden shadow-xl">
        {/* Background subtle geometric accents */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-black/10 blur-2xl pointer-events-none" />

        {/* Top Logo */}
        <div className="relative z-10">
          <HaramaqLogo module="CRM" size="lg" inverted={true} />
          <p className="text-xs uppercase tracking-widest text-white/80 font-semibold mt-2">
            Vagões Misturadores para alimentação de bovinos &bull; PROHMIX, SUPERMIX, TIPPER e
            RODOVIÁRIOS
          </p>
        </div>

        {/* Center Illustration & Silhouette */}
        <div className="relative z-10 flex flex-col items-center justify-center my-auto py-8">
          <div className="w-full max-w-md bg-white/10 p-8 rounded-2xl border border-white/20 backdrop-blur-xs shadow-2xl">
            <div className="mb-6 flex h-44 items-center justify-center">
              <div className="relative flex h-36 w-64 items-end justify-center rounded-[42%] border-4 border-white/80 bg-white/10 px-8 pb-4 shadow-inner">
                <div className="absolute -top-6 left-8 h-16 w-16 rounded-full border-4 border-white/80 bg-[#D92323]" />
                <div className="absolute -top-3 right-10 h-12 w-12 rounded-full border-4 border-white/80 bg-[#D92323]" />
                <div className="absolute bottom-2 left-5 h-7 w-7 rounded-full bg-[#1E293B] ring-2 ring-white" />
                <div className="absolute bottom-2 right-5 h-7 w-7 rounded-full bg-[#1E293B] ring-2 ring-white" />
                <div className="h-16 w-40 rounded-t-[50%] border-4 border-white/80 bg-[#FEE2E2]" />
              </div>
            </div>

            <blockquote className="text-center">
              <p className="text-lg font-bold tracking-tight text-white">
                "Eficiência que alimenta resultados"
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/80">
                Tecnologia para otimizar o manejo alimentar de bovinos de corte e leite, com
                robustez, produtividade e eficiência no campo.
              </p>
            </blockquote>
          </div>
        </div>

        {/* Footer Tagline */}
        <div className="relative z-10 text-xs text-white/80 flex items-center justify-between">
          <span>Inovação e tecnologia para o campo</span>
          <span>HARAMAQ CRM v2.0</span>
        </div>
      </div>

      {/* Login Form - Right Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-[#E2E8F0] p-8 md:p-10 shadow-lg">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-6 flex justify-center">
            <HaramaqLogo module="CRM" size="lg" inverted={false} />
          </div>

          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-[#1E293B] tracking-tight">Acesso ao Sistema</h2>
            <p className="text-xs text-[#64748B] mt-1">
              Entre com suas credenciais corporativas para acessar o CRM.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-xs md:text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#D92323]" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-[#475569]"
              >
                E-mail Corporativo
              </Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@haramaq.com.br"
                  required
                  className="pl-9 h-11 rounded-xl border-[#E2E8F0] focus:border-[#D92323] focus:ring-[#D92323] text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="pass"
                  className="text-xs font-semibold uppercase tracking-wider text-[#475569]"
                >
                  Senha de Acesso
                </Label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="pass"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-9 pr-10 h-11 rounded-xl border-[#E2E8F0] focus:border-[#D92323] focus:ring-[#D92323] text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(!!checked)}
                />
                <Label
                  htmlFor="remember"
                  className="text-xs text-[#64748B] cursor-pointer font-normal"
                >
                  Lembrar de mim
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#D92323] hover:bg-[#B91C1C] text-white font-semibold h-11 rounded-xl shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99] mt-2 text-xs"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </div>
              ) : (
                'Entrar no Sistema'
              )}
            </Button>
          </form>

          {/* Quick credentials hint for demo */}
          <div className="mt-8 pt-5 border-t border-[#E2E8F0] text-[11px] text-[#64748B] bg-[#F8FAFC] p-3.5 rounded-xl">
            <div className="flex items-center gap-1.5 font-semibold text-[#1E293B] mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D92323]" />
              <span>Acesso Administrador:</span>
            </div>
            <div className="truncate">
              E-mail:{' '}
              <code className="text-[#D92323] font-mono">elisandrodesousaharamaq@gmail.com</code>
            </div>
            <div className="mt-0.5">
              Senha: <code className="text-[#D92323] font-mono">Skip@Pass</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
