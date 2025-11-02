# Category Reordering & Editing Feature

## Nuevas funcionalidades implementadas:

### 1. **Editar Categorías**
- Botón de editar (icono de lápiz) en cada categoría
- Modal para editar nombre, descripción y color
- 8 colores predefinidos para elegir

### 2. **Reordenar Categorías con Drag & Drop**
- Arrastra las categorías usando el icono de agarre (⋮⋮)
- El orden se guarda automáticamente en la base de datos
- Usa la librería @dnd-kit para accesibilidad completa

## Migración de Base de Datos

**IMPORTANTE**: Antes de usar estas funcionalidades, debes ejecutar la migración SQL en Supabase:

1. Ve a tu proyecto en Supabase Dashboard
2. Abre el **SQL Editor**
3. Ejecuta el archivo: `supabase/migrations/20251103000001_add_category_order.sql`

O ejecuta este comando si tienes Supabase CLI:
```bash
supabase db push
```

## Cambios en el código:

### Frontend:
- ✅ `src/types/index.ts` - Añadido campo `order_index` a `Category`
- ✅ `src/lib/data.ts` - Funciones `updateCategory()` y `reorderCategories()`
- ✅ `src/components/EditCategoryModal.tsx` - Nuevo modal de edición
- ✅ `src/pages/DashboardPage.tsx` - Implementación drag & drop con @dnd-kit
- ✅ Tests actualizados con `order_index`

### Base de datos:
- ✅ Nueva columna `order_index INTEGER DEFAULT 0` en tabla `categories`
- ✅ Índice para optimizar ordenamiento
- ✅ Datos existentes migrados automáticamente

## Librerías instaladas:
```json
{
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^7.x",
  "@dnd-kit/utilities": "^3.x"
}
```

## Próximos pasos:

1. **Ejecutar la migración SQL** en Supabase
2. **Probar localmente**: `npm run dev`
3. **Verificar funcionalidad**:
   - Editar una categoría (nombre, descripción, color)
   - Arrastrar categorías para reordenarlas
   - Verificar que el orden persiste al recargar la página

## Notas técnicas:

- El drag & drop funciona con teclado para accesibilidad
- El reordenamiento se guarda inmediatamente en el backend
- Si hay múltiples páginas de categorías, el drag & drop funciona dentro de cada página
- Los colores se muestran como un pequeño círculo junto al contador de emails
