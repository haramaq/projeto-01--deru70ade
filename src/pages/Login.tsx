import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

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
    <div className="flex min-h-screen bg-[#F8FAF9]">
      {/* Brand Panel - Left Side (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1B4332] text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decorative circles/accents */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#2D6A4F]/30 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#40916C]/20 blur-2xl pointer-events-none" />

        {/* Top Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-black tracking-tight text-white flex items-center">
              HARAMAQ
              <span className="inline-block w-2.5 h-2.5 bg-[#DC2626] ml-1.5 rounded-[2px]" />
            </span>
          </div>
          <p className="text-xs uppercase tracking-widest text-emerald-300 font-semibold mt-1">
            Vagões Misturadores de Concreto &bull; PROHMIX & SUPERMIX
          </p>
        </div>

        {/* Center Illustration & Silhouette */}
        <div className="relative z-10 flex flex-col items-center justify-center my-auto py-8">
          <div className="w-full max-w-md bg-[#163628]/80 p-8 rounded-2xl border border-emerald-500/20 backdrop-blur-xs shadow-2xl">
            {/* Geometric Concrete Mixer Silhouette SVG */}
            <svg
              className="w-full h-44 text-emerald-300/80 mb-6 drop-shadow"
              viewBox="0 0 400 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Chassis / Truck Base */}
              <path
                d="M30 150 L370 150 L360 115 L280 115 L260 85 L180 85 L160 150 Z"
                fill="#2D6A4F"
                opacity="0.8"
              />
              {/* Mixer Drum (Conical/Rhombus silhouette) */}
              <path d="M70 145 L130 65 L270 75 L220 145 Z" fill="#40916C" opacity="0.9" />
              <path d="M130 65 L270 75 L215 110 L95 110 Z" fill="#DC2626" opacity="0.85" />
              {/* Spiral Stripe across drum */}
              <path
                d="M100 135 Q170 100 240 73"
                stroke="#F8FAF9"
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.9"
              />
              <path
                d="M135 145 Q195 110 260 80"
                stroke="#F8FAF9"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.7"
              />
              {/* Discharge Chute */}
              <path d="M50 110 L30 140 L45 145 L65 118 Z" fill="#DC2626" />
              {/* Wheels */}
              <circle cx="80" cy="155" r="22" fill="#111827" stroke="#40916C" strokeWidth="4" />
              <circle cx="80" cy="155" r="8" fill="#F8FAF9" />
              <circle cx="135" cy="155" r="22" fill="#111827" stroke="#40916C" strokeWidth="4" />
              <circle cx="135" cy="155" r="8" fill="#F8FAF9" />
              <circle cx="310" cy="155" r="22" fill="#111827" stroke="#40916C" strokeWidth="4" />
              <circle cx="310" cy="155" r="8" fill="#F8FAF9" />
              {/* Cab / Windshield */}
              <polygon points="280,115 320,115 340,135 280,135" fill="#A7F3D0" opacity="0.6" />
            </svg>

            <blockquote className="text-center">
              <p className="text-lg font-bold text-white tracking-tight">
                "Equipamentos que constroem o Brasil"
              </p>
              <p className="text-xs text-emerald-200/80 mt-2">
                Linhas PROHMIX e SUPERMIX &mdash; Máxima robustez, durabilidade e produtividade para
                a usinagem e transporte de concreto.
              </p>
            </blockquote>
          </div>
        </div>

        {/* Footer Tagline */}
        <div className="relative z-10 text-xs text-emerald-200/60 flex items-center justify-between">
          <span>Inovação e tecnologia para o campo</span>
          <span>CRM Corporativo v2.0</span>
        </div>
      </div>

      {/* Login Form - Right Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] p-8 md:p-10 shadow-lg">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <span className="text-2xl font-black tracking-tight text-[#1B4332] flex items-center">
              HARAMAQ
              <span className="inline-block w-2 h-2 bg-[#DC2626] ml-1 rounded-[2px]" />
            </span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#1B4332] tracking-tight">Acesso ao Sistema</h2>
            <p className="text-sm text-gray-500 mt-1">
              Entre com suas credenciais de usuário para acessar o CRM.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-xs md:text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-gray-600"
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
                  className="pl-9 h-11 rounded-xl border-gray-300 focus:border-[#1B4332] focus:ring-[#1B4332]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="pass"
                  className="text-xs font-semibold uppercase tracking-wider text-gray-600"
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
                  className="pl-9 pr-10 h-11 rounded-xl border-gray-300 focus:border-[#1B4332] focus:ring-[#1B4332]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                  className="text-xs text-gray-600 cursor-pointer font-normal"
                >
                  Lembrar de mim
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#DC2626] hover:bg-[#b91c1c] text-white font-semibold h-11 rounded-xl shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99] mt-2"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </div>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          {/* Quick credentials hint for demo */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-[11px] text-gray-500 bg-gray-50 p-3 rounded-xl">
            <span className="font-semibold text-gray-700">Acesso Administrador:</span>
            <div className="truncate mt-0.5">
              E-mail: <code className="text-[#1B4332]">elisandrodesousaharamaq@gmail.com</code>
            </div>
            <div>
              Senha: <code className="text-[#1B4332]">Skip@Pass</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
