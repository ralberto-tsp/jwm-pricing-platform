# Consulta de viajes y rentabilidad

Implementación del módulo dentro de Pricing. Estado: desarrollo aplicado, pendiente de pruebas y activación. No se modificó el ETL ni el libro fuente.

## Uso

Menú Consulta de viajes para admin, comercial y consulta. Nueva Cotización ofrece Consultar viajes anteriores, conservando el formulario de cotización y trasladando origen y destino a la búsqueda. Buscar y Limpiar, paginación de 25 OT y Ver por OT. El detalle muestra ejecuciones, importes por OT y todos los componentes de costo con su referencia.

Los filtros se aplican a una misma ejecución o registro de costo: origen, destino, OT, fecha, tipo de unidad, modalidad y carga. Seleccionan OT; sus importes corresponden siempre a toda la OT. Si hay diferentes rutas/unidades/cargas, la cabecera indica Varios. La fecha de cabecera es la primera fecha disponible de la OT, no necesariamente la ejecución que coincide con el filtro. Detalle y listado fijan el mismo lote, aun durante una importación.

MATERIAL_TRANSPOR conserva su descripción literal. JWM se presenta como Propio y TERC como Tercero; OTROS, VENTA y otros valores se conservan, sin asignaciones inferidas. No se homologa la unidad de Costos con la de Programación: las búsquedas usan Programación cuando tiene ejecuciones, y Costos como respaldo para OT sin Programación.

## Fuentes y trazabilidad

STAGING_COSTOS.csv y FACT_PROGRAMACION.csv, leídos desde una ruta configurable fuera del árbol público. El origen económico es COSTOS_ROB para 2025 y 2026. El origen operativo es FACT_PROGRAMACION. No se infiere una relación individual entre costo y ejecución por posición; ambos se consultan por OT y se presentan separados. ETL_ID, archivo, año y número de fila CSV identifican el componente dentro de su lote. No son claves globales entre publicaciones.

El importador prepara una salida semántica interna de Pricing sin añadir staging al ETL. Los campos estándar ya están en STAGING_COSTOS. No requiere FACT_COSTOS_OT ni FACT_SERVICIOS_COMERCIAL para el cálculo: usa los fletes y resultados de la misma fuente de costos, manteniendo la base del libro. No mezclar esa suma con FLETE_TOTAL_REFERENCIA, cuya regla es distinta. Los totales por OT suman componentes y requieren conciliación funcional para las OT con fletes repetidos.

Validación de estructura, datos no vacíos, SERVICIO_ID únicos, cortes ETL dentro de 30 minutos y estabilidad de archivos durante lectura. La ventana temporal detecta cortes incompatibles, pero no reemplaza un identificador de lote oficial: ejecutar después de concluir el ETL y validar su éxito. Se registra hash SHA256 de cada archivo y fecha ETL. Las fechas ETL del CSV son locales sin zona; se conserva el texto original sin convertirlo a UTC. UTC se usa internamente solo para comparar intervalos entre esas fechas.

## Reglas económicas

- Otros depurados = OTROS original − PEAJE_COSTO − VIATICO − COSTO_NEUMATICO − COMISIONES_COMERCIAL_3. No truncar resultados negativos ni modificar el libro.
- COGS FINAL conserva el valor del libro. Conciliación: combustible + peaje + viático + neumáticos + comisiones + otros depurados + terceros.
- SUELDO_OPERATIVO es informativo y no se suma al COGS, respetando la fórmula fuente.
- Flete: TOTAL_FLETE_JWM; utilidad bruta: UT_BRUTA. Porcentaje referencial = suma de utilidades / suma de fletes. No se importa UT % BRUTA: el normalizador actual colisiona con UT_BRUTA, por lo que se deriva desde sus importes.
- Resultado operativo: STD_UT_OPERATIVA guardado. OPEX: OPEX guardado. No se recalculan con parámetros actuales. Base registrada si Estado es exactamente Cerrado; estándar para otros estados. Una OT con ambas bases muestra Varios.
- Std COGS y Std Contr Marg se conservan separados de COGS registrado. Margen estándar = contribución estándar / flete. Margen operativo = utilidad operativa / flete.
- REND_KM_GL se conserva por componente. No se promedia ni se cambia la unidad; el libro contiene fórmulas inversas y valores manuales. Kilómetros, galones, factor y días estándar se muestran por componente.
- OPEX diario por factor se deriva solo si factor y días son positivos: OPEX / (factor × días). Es una referencia derivada, no un parámetro histórico independiente exportado.
- Importes vacíos/no numéricos se mantienen sin dato. Cero numérico permanece cero. Un concepto con componentes incompletos no se presenta como suma completa por OT. Otros depurados sigue el tratamiento de celdas vacías de la suma de Excel, preservando los vacíos individuales y avisos.
- Se advierte sobre COGS/utilidad sin conciliación, componentes faltantes y resultados operativos incompletos. Los avisos no certifican cierre de liquidación.
- Moneda mostrada PEN como el reporte fuente. El staging de Costos no contiene moneda o tipo de cambio por fila; confirmar PEN y tratamiento fiscal antes de certificar. No aplica conversión automática ni ajustes de IGV nuevos.

## Base de datos y API

sql/consulta-viajes.sql crea solo tablas nuevas: lotes, puntero activo, OT y registros operativos para filtros. No toca cotizaciones ni drivers. Importación con exclusión mutua, transacción y activación al terminar. Un fallo conserva el puntero anterior; una carga del mismo contenido reutiliza el lote. Se conservan lotes anteriores para detalle consistente y futura política de retención.

GET /api/consulta-viajes devuelve items, total, pagina, paginas y lote. Parámetros origen, destino, ot, desde, hasta, unidad, modalidad, carga y pagina. Búsqueda textual por contenido, con parámetros SQL, fechas validadas y filtros de la misma fila. GET /api/consulta-viajes/:ot?lote=HASH devuelve resumen, componentes y ejecuciones. Ambos requieren sesión y rol admin/comercial/consulta. La carga no se publica como endpoint web.

El servidor publica únicamente assets, css, js, views, vendor e index.html. Los CSV, documentación, SQL, scripts y secretos no se sirven como archivos estáticos.

## Activación, después de autorizar pruebas y destino

Desde la raíz de Pricing, con Node y las dependencias existentes:

1. Prueba mínima económica sin base de datos: `node --test tests/consulta-viajes.test.js`.
2. Preparación de importación, sin escritura MySQL: `node server/importar-consulta-viajes.js --staging "RUTA_STAGING"`.
3. Aplicar migración únicamente al destino aprobado: `node server/migrar-consulta-viajes.js --aplicar`.
4. Publicar datos únicamente al destino aprobado: `node server/importar-consulta-viajes.js --staging "RUTA_STAGING" --aplicar`.
5. Iniciar el sistema y verificar navegación, roles, filtros, detalle, porcentajes y retorno a la cotización.

Alternativa de ruta: variable JWM_STAGING_DIR. Las conexiones usan la configuración DB existente. El modo de preparación no abre conexión MySQL. No registrar automáticamente una tarea de Windows ni desplegar desde este script. La automatización periódica es un paso posterior, después de certificar el lote y la carga.

## Casos de aceptación pendientes

OT con una fila y con varias ejecuciones/fletes; OT sin costo; diferencias entre blancos y ceros; costos de terceros; descripción original de carga; Otros depurados negativos; bases operativas mezcladas; margen ponderado; fechas inválidas y filtros combinados; reimportación idéntica; fallo antes de activar lote; acceso anónimo bloqueado; acceso de los tres roles; recursos privados inaccesibles y cotización en edición conservada.

El diagnóstico funcional de composición de OPEX sigue limitado a su presupuesto general; no se certifica ausencia de solapamientos con costos. Se conservan resultados y etiquetas referenciales del libro. No hubo pruebas, migración, conexión remota, importación ni despliegue durante esta fase.
