/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import IndustrialSurveyPage from '../modules/industrialSurvey/IndustrialSurveyPage';
import { Surveyor } from '../types/user';

interface Props {
  currentUser?: Surveyor | null;
  onNotification?: (type: 'success' | 'error', message: string) => void;
  onSwitchToHousehold?: () => void;
  onLogout?: () => void;
}

export default function IndustrialSurveyModule({ 
  currentUser, 
  onNotification, 
  onSwitchToHousehold, 
  onLogout 
}: Props) {
  return (
    <IndustrialSurveyPage
      currentUser={currentUser}
      onNotification={onNotification}
      onSwitchToHousehold={onSwitchToHousehold}
      onLogout={onLogout}
    />
  );
}
