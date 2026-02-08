-- Habilitar RLS nas tabelas (se já estiver habilitado, não gera erro, mas é bom garantir)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas para evitar erro de "já existe"
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own generations" ON generations;
DROP POLICY IF EXISTS "Users can insert own generations" ON generations;
DROP POLICY IF EXISTS "Users can update own generations" ON generations;

-- Policy para 'profiles': Usuários podem ver apenas seu próprio perfil
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- Policy para 'profiles': Usuários podem atualizar apenas seu próprio perfil
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- Policy para 'generations': Usuários podem ver apenas suas próprias gerações
CREATE POLICY "Users can view own generations" 
ON generations FOR SELECT 
USING (auth.uid() = user_id);

-- Policy para 'generations': Usuários podem criar suas próprias gerações
CREATE POLICY "Users can insert own generations" 
ON generations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy para 'generations': Usuários podem atualizar apenas suas próprias gerações (ex: marcar como deletado)
CREATE POLICY "Users can update own generations" 
ON generations FOR UPDATE 
USING (auth.uid() = user_id);
