export const CARTERA_VIEWS = {
  'cartera-actual': {
    label: 'Cartera actual',
    description: 'Capital pendiente de cobro en todos los periodos (pendiente + moroso).',
  },
  recaudo: {
    label: 'Recaudo del mes',
    description: 'Pagos recibidos en el periodo seleccionado.',
  },
  morosidad: {
    label: 'Morosidad total',
    description: 'Saldo en mora en todos los periodos.',
  },
  pendiente: {
    label: 'Pendiente del mes',
    description: 'Cuotas del periodo aún no pagadas y al día.',
  },
  facturado: {
    label: 'Facturado del mes',
    description: 'Total facturado en el periodo, sin importar el estado.',
  },
  'tasa-recaudo': {
    label: 'Tasa de recaudo',
    description: 'Comparativo de lo facturado vs lo recaudado en el periodo.',
  },
};

export const CARTERA_VIEW_IDS = Object.keys(CARTERA_VIEWS);
