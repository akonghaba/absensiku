import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wegpfdgtairwjvvdikaq.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_To4902KKLrUEBUf9i4Y-EQ_AtZit5_o'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const ROLE_LABEL = { owner: 'Owner', guru: 'Guru', sekretaris: 'Sekretaris', murid: 'Murid' }
const STATUSES = ['Hadir', 'Izin', 'Sakit', 'Alpa']
const today = () => new Date().toLocaleDateString('en-CA')

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [mode, setMode] = useState(new URLSearchParams(location.search).get('mode') === 'reset' ? 'update-password' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState([])
  const [accounts, setAccounts] = useState([])
  const [selectedDate, setSelectedDate] = useState(today())
  const [tab, setTab] = useState('presensi')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) setProfile(null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user) loadProfile(session.user.id)
  }, [session?.user?.id])

  async function loadProfile(id) {
    const { data, error } = await supabase.from('profiles').select('id,full_name,role,class_name').eq('id', id).maybeSingle()
    if (error) { setError(`Gagal memuat profil: ${error.message}`); return }
    setProfile(data)
  }

  useEffect(() => {
    if (profile) loadWorkspace()
  }, [profile?.id, profile?.role, selectedDate])

  async function loadWorkspace() {
    setError('')
    const { data: studentRows, error: studentError } = await supabase.from('students').select('id,name,nis,class_name,gender,user_id').eq('class_name', profile.class_name || 'XI TKJ').order('name')
    if (studentError) { setError(`Data siswa gagal dimuat: ${studentError.message}`); return }
    setStudents(studentRows || [])
    const { data: attendanceRows, error: attendanceError } = await supabase.from('attendance').select('id,student_id,student_nis,student_name,class_name,attendance_date,status,note,created_at').eq('class_name', profile.class_name || 'XI TKJ').eq('attendance_date', selectedDate)
    if (attendanceError) setError(`Data presensi gagal dimuat: ${attendanceError.message}`)
    else setAttendance(attendanceRows || [])
    if (profile.role === 'owner') {
      const { data: profileRows, error: profileError } = await supabase.from('profiles').select('id,full_name,role,class_name').order('created_at', { ascending: false })
      if (profileError) setError(`Daftar akun gagal dimuat: ${profileError.message}`)
      else setAccounts(profileRows || [])
    }
  }

  async function handleAuth(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const redirectTo = `${location.origin}${location.pathname}`
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: redirectTo } })
        if (error) throw error
        if (!data.session) setMessage('Pendaftaran dibuat. Cek email untuk verifikasi sebelum login.')
        else setMessage('Akun berhasil dibuat. Role awal otomatis Murid.')
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${redirectTo}?mode=reset` })
        if (error) throw error
        setMessage('Link reset sandi dikirim jika email terdaftar. Cek inbox dan folder spam.')
      } else if (mode === 'update-password') {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setMessage('Sandi berhasil diganti. Silakan lanjut ke dashboard.')
        history.replaceState({}, '', redirectTo)
        setMode('login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e) { setError(e.message || 'Ada masalah saat autentikasi.') }
    finally { setBusy(false) }
  }

  async function logout() { await supabase.auth.signOut(); setProfile(null); setSession(null); setMode('login'); setMessage('') }

  async function setRole(accountId, role) {
    setError(''); setMessage('')
    const { error } = await supabase.rpc('owner_set_user_role', { target_user_id: accountId, new_role: role })
    if (error) { setError(`Role gagal diubah: ${error.message}`); return }
    setMessage('Role akun berhasil diperbarui.');
    await loadWorkspace()
  }

  async function saveAttendance(student, status) {
    setError(''); setMessage('')
    const existing = attendance.find(a => a.student_id === student.id)
    const row = { student_id: student.id, student_nis: student.nis, student_name: student.name, class_name: student.class_name || profile.class_name || 'XI TKJ', attendance_date: selectedDate, status, note: existing?.note || '' }
    const result = await supabase.from('attendance').upsert(row, { onConflict: 'student_id,attendance_date' }).select().single()
    if (result.error) { setError(`Gagal menyimpan presensi: ${result.error.message}`); return }
    setAttendance(old => [...old.filter(a => a.student_id !== student.id), result.data])
    setMessage(`Presensi ${student.name} tersimpan.`)
  }

  const isStaff = ['owner', 'guru', 'sekretaris'].includes(profile?.role)
  const attendanceMap = useMemo(() => new Map(attendance.map(a => [a.student_id, a])), [attendance])

  if (!session || mode === 'update-password') return <main className="auth-shell"><section className="brand"><div className="logo">A</div><div><h1>AbsensiKu</h1><p>Presensi kelas · XI TKJ</p></div></section><section className="panel auth-panel"><h2>{mode === 'signup' ? 'Buat akun' : mode === 'forgot' ? 'Reset sandi' : mode === 'update-password' ? 'Buat sandi baru' : 'Masuk AbsensiKu'}</h2><p className="muted">{mode === 'signup' ? 'Akun baru otomatis mendapat akses Murid sampai Owner mengubah role.' : mode === 'forgot' ? 'Kami kirim tautan reset ke email lu.' : mode === 'update-password' ? 'Masukkan sandi baru untuk akun lu.' : 'Login pakai akun yang sudah terdaftar.'}</p><form onSubmit={handleAuth}>{mode === 'signup' && <label>Nama lengkap<input value={fullName} onChange={e=>setFullName(e.target.value)} required autoComplete="name" /></label>}{mode !== 'update-password' && <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" /></label>}{mode !== 'forgot' && <label>{mode === 'update-password' ? 'Sandi baru' : 'Password'}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>}<button disabled={busy}>{busy ? 'Memproses…' : mode === 'signup' ? 'Daftar' : mode === 'forgot' ? 'Kirim link reset' : mode === 'update-password' ? 'Simpan sandi baru' : 'Masuk'}</button></form>{error && <p className="alert error">{error}</p>}{message && <p className="alert success">{message}</p>}<div className="auth-links">{mode !== 'login' && <button className="link" onClick={()=>{setMode('login');setError('');setMessage('')}}>Kembali ke login</button>}{mode === 'login' && <><button className="link" onClick={()=>setMode('signup')}>Belum punya akun? Daftar</button><button className="link" onClick={()=>setMode('forgot')}>Lupa sandi?</button></>}</div></section><p className="foot">AbsensiKu · Jangan pernah memasukkan service_role key ke frontend.</p></main>

  if (!profile) return <main className="center"><div className="spinner"/><p>Memuat profil akun…</p>{error && <p className="alert error">{error}</p>}<button className="secondary" onClick={logout}>Keluar</button></main>

  return <main className="app-shell"><header className="topbar"><section className="brand"><div className="logo">A</div><div><h1>AbsensiKu</h1><p>Presensi kelas · {profile.class_name || 'XI TKJ'}</p></div></section><div className="account-email">{session.user.email}</div></header><section className="welcome"><div><h2>Halo, {profile.full_name || ROLE_LABEL[profile.role] || 'Pengguna'}</h2><p>{profile.class_name} · {ROLE_LABEL[profile.role] || profile.role}</p></div><button className="secondary" onClick={logout}>Keluar</button></section>{error && <p className="alert error">{error}</p>}{message && <p className="alert success">{message}</p>}<section className="stats"><article><span>Siswa terdaftar</span><strong>{students.length}</strong></article><article><span>Tanggal dipilih</span><strong>{selectedDate}</strong></article><article><span>Akses</span><strong>{ROLE_LABEL[profile.role] || profile.role}</strong></article></section><nav className="tabs">{[['presensi','Presensi'],['siswa','Data siswa'],['riwayat','Riwayat'],...(profile.role === 'owner' ? [['akun','Kelola akun']] : [])].map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</nav>
  {tab === 'presensi' && <section className="panel"><h2>Presensi harian</h2><p className="muted">{isStaff ? 'Pilih status untuk menyimpan presensi siswa.' : 'Lu hanya bisa melihat data presensi akun yang ditautkan.'}</p><label className="date-label">Tanggal<input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} /></label>{students.filter(s=>isStaff || s.user_id===session.user.id).map(student=>{const record=attendanceMap.get(student.id);return <div className="student-row" key={student.id}><div className="student-info"><strong>{student.name}</strong><span>NIS: {student.nis}</span><small>{record?.status || 'Belum diisi'}</small></div>{isStaff ? <select value={record?.status || ''} onChange={e=>saveAttendance(student,e.target.value)}><option value="" disabled>Pilih status</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select> : <b>{record?.status || 'Belum ada data'}</b>}</div>})}{students.length===0&&<p className="muted">Belum ada data siswa di kelas ini.</p>}</section>}
  {tab === 'siswa' && <section className="panel"><h2>Data siswa</h2>{isStaff ? <p className="muted">Daftar siswa dari database Supabase. Tambah/edit siswa bisa diaktifkan setelah skema dan kebijakan tabel dipastikan cocok.</p> : <p className="muted">Data siswa yang terlihat dibatasi oleh izin database.</p>}{students.filter(s=>isStaff||s.user_id===session.user.id).map(s=><div className="student-row" key={s.id}><div className="student-info"><strong>{s.name}</strong><span>NIS: {s.nis}</span><small>{s.class_name}</small></div></div>)}</section>}
  {tab === 'riwayat' && <section className="panel"><h2>Riwayat presensi</h2><label className="date-label">Tanggal<input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} /></label>{attendance.filter(a=>isStaff || a.student_id===students.find(s=>s.user_id===session.user.id)?.id).map(a=><div className="student-row" key={a.id}><div className="student-info"><strong>{a.student_name}</strong><span>{a.attendance_date} · NIS {a.student_nis}</span></div><b>{a.status}</b></div>)}</section>}
  {tab === 'akun' && profile.role === 'owner' && <section className="panel"><h2>Kelola akun</h2><p className="muted">Akun baru otomatis Murid. Hanya Owner yang bisa mengubah role.</p>{accounts.map(account=><div className="student-row account-row" key={account.id}><div className="student-info"><strong>{account.full_name || 'Tanpa nama'}</strong><span>{account.id}</span><small>{account.class_name}</small></div><select value={account.role} onChange={e=>setRole(account.id,e.target.value)}>{Object.entries(ROLE_LABEL).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></div>)}</section>}
  <footer className="foot">AbsensiKu · XI TKJ · GitHub Pages + Supabase</footer></main>
}
