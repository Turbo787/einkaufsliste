# Supabase-Hinweis

1. Öffne in Supabase den **SQL Editor**.
2. Führe den Inhalt aus `supabase/schema.sql` vollständig aus.
3. Prüfe unter **Database > Replication**, dass `public.shopping_items` für Realtime aktiv ist.
   - Das SQL-Script versucht die Tabelle automatisch zur Publication `supabase_realtime` hinzuzufügen.
4. Verwende im Frontend nur:
   - **Project URL**
   - **anon public key**

⚠️ Kein `service_role` Key im Browser verwenden.
