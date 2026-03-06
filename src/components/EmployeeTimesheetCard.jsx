// attendance-frontend/src/components/EmployeeTimesheetCard.jsx
import React, { useState, useEffect } from "react";
import api from "../api";

export default function EmployeeTimesheetCard({ records, project, currentMonth, currentYear }) {
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(currentYear || new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth || new Date().getMonth() + 1);
  const [extraHoursSummary, setExtraHoursSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load available years
  useEffect(() => {
    loadAvailableYears();
    loadExtraHoursSummary();
  }, [selectedMonth, selectedYear]);

  // Load available years for dropdown
  const loadAvailableYears = async () => {
    try {
      const response = await api.get("/leave/years");
      setAvailableYears(response.data);
    } catch (error) {
      console.error("Error loading years:", error);
      const currentYear = new Date().getFullYear();
      setAvailableYears([currentYear, currentYear - 1, currentYear - 2]);
    }
  };

  // Load extra hours summary
  const loadExtraHoursSummary = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/attendance/extra-hours/${localStorage.getItem('userId')}?month=${selectedMonth}&year=${selectedYear}`);
      setExtraHoursSummary(response.data);
    } catch (error) {
      console.error("Error loading extra hours:", error);
      setExtraHoursSummary(null);
    } finally {
      setLoading(false);
    }
  };

  // Calculate project hours from attendance records
  const calculateProjectHours = (attendanceRecords) => {
    let totalHours = 0;
    const daily = [];

    attendanceRecords.forEach(record => {
      let projectHours = 0;
      
      if (record.status === "WORK FROM HOME") {
        projectHours = 8;
      }
      else if (record.status === "PRESENT FULL DAY") {
        // Calculate hours from work times
        if (record.workInTime && record.workOutTime) {
          const [inHour, inMin] = record.workInTime.split(":").map(Number);
          const [outHour, outMin] = record.workOutTime.split(":").map(Number);
          
          const inMinutes = inHour * 60 + inMin;
          const outMinutes = outHour * 60 + outMin;
          const totalMinutes = outMinutes - inMinutes;
          
          projectHours = totalMinutes / 60;
          
          // Cap at 8 hours for regular work day
          if (projectHours > 8) {
            projectHours = 8;
          }
        } else {
          projectHours = 8; // Default 8 hours for full day
        }
      } else if (record.status === "PRESENT HALF DAY" || 
                 record.status === "Half Day - Fun Thursday" || 
                 record.status === "Half Day - Development") {
        projectHours = 4; // Half day = 4 hours
      } else if (record.status === "COMPOFF") {
        // Comp-off hours from extra work
        if (record.extraWork?.hours) {
          projectHours = parseFloat(record.extraWork.hours) || 0;
        }
      }
      
      totalHours += projectHours;
      
      daily.push({
        _id: record._id,
        date: record.date,
        status: record.status,
        workInTime: record.workInTime || "-",
        workOutTime: record.workOutTime || "-",
        projectHours: projectHours.toFixed(1),
        extraHours: record.extraHoursWorked || 0,
        extraHoursApproved: record.extraHoursApproved || false
      });
    });

    return { totalHours, daily };
  };

  const { totalHours, daily } = calculateProjectHours(records);
  const totalEstimate = project?.totalEstimatedHours || 0;
  const remaining = Math.max(0, totalEstimate - totalHours);
  const completionPercentage = totalEstimate > 0 ? (totalHours / totalEstimate * 100) : 0;

  // Month names for dropdown
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="card timesheet-card">
      <div className="timesheet-header">
        <h2>Timesheet – Project Hours</h2>
        
        {/* Year/Month Selector */}
        <div className="timesheet-filters">
          <div className="filter-group">
            <label>Year:</label>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="year-select"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Month:</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="month-select"
            >
              {monthNames.map((month, index) => (
                <option key={index + 1} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Project Info */}
      {project ? (
        <div className="project-info">
          <h3>{project.name} {project.code ? `(${project.code})` : ''}</h3>
          <div className="project-dates">
            <span>Start: {project.startDate}</span>
            <span>End: {project.endDate}</span>
            <span>Duration: {project.durationMonths || 0} months</span>
          </div>
        </div>
      ) : (
        <div className="no-project-warning">
          <p>⚠️ No project assigned yet. Please contact your manager.</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-title">Project Estimate</div>
          <div className="summary-value">{totalEstimate} hrs</div>
          <div className="summary-subtitle">Total Hours</div>
        </div>
        
        <div className="summary-card">
          <div className="summary-title">Worked Hours</div>
          <div className="summary-value">{totalHours.toFixed(1)} hrs</div>
          <div className="summary-subtitle">This Month</div>
        </div>
        
        <div className="summary-card">
          <div className="summary-title">Remaining</div>
          <div className="summary-value">{remaining.toFixed(1)} hrs</div>
          <div className="summary-subtitle">Balance</div>
        </div>
        
        <div className="summary-card">
          <div className="summary-title">Completion</div>
          <div className="summary-value">{completionPercentage.toFixed(1)}%</div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${Math.min(completionPercentage, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Extra Hours Summary */}
      {extraHoursSummary && (
        <div className="extra-hours-summary">
          <h4>Extra Hours & Comp-off Summary</h4>
          <div className="extra-hours-cards">
            <div className="extra-hours-card">
              <div className="extra-hours-title">Total Extra Hours</div>
              <div className="extra-hours-value">{extraHoursSummary.totalExtraHours.toFixed(1)} hrs</div>
            </div>
            
            <div className="extra-hours-card approved">
              <div className="extra-hours-title">Approved Hours</div>
              <div className="extra-hours-value">{extraHoursSummary.approvedExtraHours.toFixed(1)} hrs</div>
            </div>
            
            <div className="extra-hours-card pending">
              <div className="extra-hours-title">Pending Approval</div>
              <div className="extra-hours-value">{extraHoursSummary.pendingExtraHours.toFixed(1)} hrs</div>
            </div>
            
            <div className="extra-hours-card compoff">
              <div className="extra-hours-title">Comp-off Balance</div>
              <div className="extra-hours-value">{extraHoursSummary.compOffBalance.toFixed(1)} days</div>
              <div className="extra-hours-note">
                ({extraHoursSummary.approvedExtraHours} hours ÷ 8)
              </div>
            </div>
          </div>
          
          {extraHoursSummary.records && extraHoursSummary.records.length > 0 && (
            <div className="extra-hours-details">
              <h5>Extra Hours Details:</h5>
              <div className="table-wrapper small-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Hours</th>
                      <th>Status</th>
                      <th>Approval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extraHoursSummary.records.map((record, index) => (
                      <tr key={index}>
                        <td>{record.date}</td>
                        <td>{record.hours.toFixed(1)} hrs</td>
                        <td>{record.status}</td>
                        <td>
                          <span className={`approval-badge ${record.approved ? 'approved' : 'pending'}`}>
                            {record.approved ? '✓ Approved' : '⏳ Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detailed Timesheet Table */}
      <div className="timesheet-details">
        <h4>Daily Hours Breakdown - {monthNames[selectedMonth - 1]} {selectedYear}</h4>
        <div className="table-wrapper">
          <table className="timesheet-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Status</th>
                <th>In Time</th>
                <th>Out Time</th>
                <th>Regular Hours</th>
                <th>Extra Hours</th>
                <th>Project Hours</th>
                <th>Approval Status</th>
              </tr>
            </thead>
            <tbody>
              {daily.length > 0 ? (
                daily.map((day) => {
                  const dateObj = new Date(day.date.split("-").reverse().join("-"));
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                  
                  return (
                    <tr key={day._id} className={day.status === "SUNDAY" || day.status === "2ND SATURDAY" || day.status === "PUBLIC HOLIDAY" ? "holiday-row" : ""}>
                      <td>{day.date}</td>
                      <td>{dayName}</td>
                      <td>
                        <span className={`status-indicator ${day.status}`}>
                          {day.status}
                        </span>
                      </td>
                      <td>{day.workInTime}</td>
                      <td>{day.workOutTime}</td>
                      <td>
                        {day.status.includes("PRESENT") || day.status === "WORK FROM HOME"
                          ? "8.0"
                          : "0.0"}
                      </td>
                      <td>
                        {day.extraHours > 0 ? (
                          <span className={`extra-hours-indicator ${day.extraHoursApproved ? 'approved' : 'pending'}`}>
                            {day.extraHours.toFixed(1)} hrs
                            {day.extraHoursApproved && <span className="checkmark"> ✓</span>}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <strong>{day.projectHours} hrs</strong>
                      </td>
                      <td>
                        {day.status === "COMPOFF" || day.extraHours > 0 ? (
                          <span className={`approval-status ${day.extraHoursApproved ? 'approved' : 'pending'}`}>
                            {day.extraHoursApproved ? "Approved" : "Pending"}
                          </span>
                        ) : (
                          <span className="approval-status auto">Auto</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="empty-message">
                    {loading ? "Loading..." : "No attendance records for this month."}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="5" className="total-label"><strong>Monthly Totals:</strong></td>
                <td><strong>{(daily.filter(d => d.status.includes("PRESENT") || d.status === "WORK FROM HOME").length * 8).toFixed(1)} hrs</strong></td>
                <td><strong>{daily.reduce((sum, d) => sum + (d.extraHours || 0), 0).toFixed(1)} hrs</strong></td>
                <td><strong>{totalHours.toFixed(1)} hrs</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="timesheet-legend">
        <div className="legend-title">Legend:</div>
        <div className="legend-items">
          <span className="legend-item">
            <span className="legend-color working-day"></span>
            <span>Working Day</span>
          </span>
          <span className="legend-item">
            <span className="legend-color holiday"></span>
            <span>Holiday/Weekend</span>
          </span>
          <span className="legend-item">
            <span className="legend-color extra-hours"></span>
            <span>Extra Hours</span>
          </span>
          <span className="legend-item">
            <span className="legend-color compoff"></span>
            <span>Comp-off</span>
          </span>
        </div>
      </div>
    </div>
  );
}