import { useState } from 'react'
import {
  LayoutDashboard, KanbanSquare, TableProperties, PanelRightClose,
  Settings, Eye, Play, Sparkles
} from 'lucide-react'
import Layout from '../components/Layout'
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton'
import PipelineSkeleton from '../components/skeletons/PipelineSkeleton'
import LeadTableSkeleton from '../components/skeletons/LeadTableSkeleton'
import LeadDrawerSkeleton from '../components/skeletons/LeadDrawerSkeleton'
import ConfiguracoesSkeleton from '../components/skeletons/ConfiguracoesSkeleton'

type SkeletonTab = 'dashboard' | 'pipeline' | 'table' | 'drawer' | 'config'

export default function SkeletonPreview() {
  const [currentTab, setCurrentTab] = useState<SkeletonTab>('dashboard')
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulatedReady, setSimulatedReady] = useState(false)

  function runSimulation() {
    setIsSimulating(true)
    setSimulatedReady(false)
    setTimeout(() => {
      setIsSimulating(false)
      setSimulatedReady(true)
    }, 1800)
  }

  return (
    <Layout>
      <div className="px-8 py-8 w-full min-w-0">
        {/* Top Header & Interactive Controls */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-card mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                  <Sparkles size={16} />
                </span>
                <h1 className="text-slate-950 text-lg font-bold">Galeria de Skeletons 1:1 & Cascata</h1>
              </div>
              <p className="text-slate-500 text-xs mt-1">
                Visualização contínua e teste da cadência do Shimmer suave (2.4s) em cada tela do sistema.
              </p>
            </div>

            <div className="flex items-center gap-2 self-stretch md:self-auto">
              <button
                type="button"
                onClick={runSimulation}
                disabled={isSimulating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 border border-emerald-700/50 text-white text-xs font-bold transition shadow-2xs cursor-pointer select-none"
              >
                <Play size={13} className={isSimulating ? 'animate-spin' : ''} />
                {isSimulating ? 'Carregando (1.8s)...' : 'Simular Transição Cascata'}
              </button>
            </div>
          </div>

          {/* Abas de Skeletons */}
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-100">
            <button
              onClick={() => { setCurrentTab('dashboard'); setSimulatedReady(false) }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <LayoutDashboard size={14} />
              1. Dashboard
            </button>

            <button
              onClick={() => { setCurrentTab('pipeline'); setSimulatedReady(false) }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                currentTab === 'pipeline'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <KanbanSquare size={14} />
              2. Pipeline (Funil)
            </button>

            <button
              onClick={() => { setCurrentTab('table'); setSimulatedReady(false) }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                currentTab === 'table'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <TableProperties size={14} />
              3. Tabela de Leads
            </button>

            <button
              onClick={() => { setCurrentTab('drawer'); setSimulatedReady(false) }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                currentTab === 'drawer'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <PanelRightClose size={14} />
              4. Gaveta do Lead (Drawer)
            </button>

            <button
              onClick={() => { setCurrentTab('config'); setSimulatedReady(false) }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                currentTab === 'config'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <Settings size={14} />
              5. Configurações
            </button>
          </div>
        </div>

        {/* Viewport do Skeleton Selecionado */}
        <div className="relative">
          {simulatedReady ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center animate-cascade-item">
              <span className="inline-flex p-3 rounded-full bg-emerald-100 text-emerald-700 mb-3 shadow-2xs">
                <Sparkles size={24} />
              </span>
              <h3 className="text-slate-900 font-bold text-base">Transição em Cascata Concluída!</h3>
              <p className="text-slate-600 text-xs mt-1 max-w-md mx-auto">
                Na aplicação real, os blocos entram escalonados com <code>animation-delay</code> progressivo logo após o término do carregamento.
              </p>
              <button
                onClick={() => setSimulatedReady(false)}
                className="mt-4 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer shadow-2xs"
              >
                Voltar a ver o Skeleton contínuo
              </button>
            </div>
          ) : (
            <div className="animate-fade-in">
              {currentTab === 'dashboard' && <DashboardSkeleton />}
              {currentTab === 'pipeline' && <PipelineSkeleton />}
              {currentTab === 'table' && <LeadTableSkeleton rows={8} />}
              {currentTab === 'drawer' && (
                <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2">
                    <Eye size={14} /> Simulação da Gaveta Lateral (LeadDrawer)
                  </div>
                  <LeadDrawerSkeleton />
                </div>
              )}
              {currentTab === 'config' && <ConfiguracoesSkeleton />}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
