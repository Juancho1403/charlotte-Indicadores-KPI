import axios from 'axios';
import { envs } from '../../config/envs.js';

let mock;
if (envs.USE_MOCK_SERVICES) {
  // Lazy import mock consumers
  // eslint-disable-next-line import/no-unresolved
  mock = await import('./mockConsumers.js');
}

const axiosJson = axios.create({ timeout: 8000 });

export async function fetchComandas(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchComandas(params);
  const url = `${envs.AT_CLIENT_BASE_URL}/comandas`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

export async function fetchComandaById(id) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchComandaById(id);
  const url = `${envs.AT_CLIENT_BASE_URL}/comandas/${id}`;
  const res = await axiosJson.get(url);
  return res.data;
}

export async function fetchKdsQueue() {
  if (envs.USE_MOCK_SERVICES) return mock.fetchKdsQueue();
  const url = `${envs.KDS_BASE_URL}/kds/queue`;
  const res = await axiosJson.get(url);
  return res.data;
}

export async function fetchKdsHistory() {
  if (envs.USE_MOCK_SERVICES) return mock.fetchKdsHistory();
  const url = `${envs.KDS_BASE_URL}/kds/history`;
  const res = await axiosJson.get(url);
  return res.data;
}

export async function fetchInventoryItems(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchInventoryItems(params);
  const url = `${envs.INVENTORY_BASE_URL}/inventory/items`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

export async function fetchProducts(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchProducts(params);
  const url = `${envs.INVENTORY_BASE_URL}/products`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

export async function fetchStaff(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchStaff(params);
  const url = `${envs.KDS_BASE_URL}/staff`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

export async function fetchDeliveryOrders(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchDeliveryOrders(params);
  const url = `${envs.DELIVERY_BASE_URL}/orders`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}
